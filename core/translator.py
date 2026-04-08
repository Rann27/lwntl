"""
Translator Module - Smart Iteration + Streaming
Implements anti-truncation translation with real-time streaming per Section 8.4-8.5
"""

import threading
import asyncio
import json
import time
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from .llm_client import LLMClient
from .storage.series import get_series
from .storage.chapters import (
    update_chapter_status, update_chapter_translation,
    update_chapter_summary, update_translation_log, get_chapter
)
from .prompt_builder import build_system_prompt, build_user_prompt
from .extractor import extract_glossary_terms
from .context_window import build_context_window, generate_chapter_summary


class Translator:
    """
    Handles chapter translation with smart iteration and streaming
    """
    
    def __init__(self, llm_client: LLMClient, window_eval: Optional[Callable] = None):
        """
        Initialize translator
        
        Args:
            llm_client: LLMClient instance
            window_eval: PyWebView window.evaluate_js callback for streaming
        """
        self.client = llm_client
        self.window_eval = window_eval
        self._cancelled = False
        self._translation_thread = None
        self._total_tokens = 0
        self._iteration = 0
        self._batch_active = False
        self._batch_total = 0
        self._batch_completed = 0
    
    def cancel(self) -> bool:
        """
        Cancel ongoing translation (including batch)
        
        Returns:
            bool: True if cancellation was successful
        """
        self._cancelled = True
        self._batch_active = False
        return True
    
    def start_batch_translation(
        self,
        series_id: str,
        chapter_ids: List[str],
        progress_callback: Optional[Callable] = None
    ) -> threading.Thread:
        """
        Start batch translation for multiple chapters in sequence.
        Only translates chapters with status 'pending' (never translated).
        """
        self._batch_active = True
        self._batch_total = len(chapter_ids)
        self._batch_completed = 0
        
        thread = threading.Thread(
            target=self._batch_translate,
            args=(series_id, chapter_ids, progress_callback),
            daemon=True
        )
        thread.start()
        return thread
    
    def _batch_translate(
        self,
        series_id: str,
        chapter_ids: List[str],
        progress_callback: Optional[Callable] = None
    ):
        """Internal batch translation - translates chapters sequentially, skips non-pending."""
        for i, chapter_id in enumerate(chapter_ids):
            if not self._batch_active or self._cancelled:
                if self.window_eval:
                    self.window_eval(f"window.onBatchStatus({json.dumps({'status': 'cancelled', 'completed': self._batch_completed, 'total': self._batch_total})})")
                break
            
            # Check chapter status - skip if not pending
            chapter = get_chapter(series_id, chapter_id)
            if not chapter or chapter.get("status") != "pending":
                self._batch_completed += 1
                continue
            
            # Send batch progress
            if self.window_eval:
                self.window_eval(f"window.onBatchStatus({json.dumps({'status': 'translating', 'current': i + 1, 'total': self._batch_total, 'chapterId': chapter_id, 'chapterNumber': chapter.get('chapterNumber', '?'), 'chapterTitle': chapter.get('title', '')})})")
            
            # Translate this chapter
            self._translate(series_id, chapter_id, progress_callback)
            
            self._batch_completed += 1
            
            # Small pause between chapters
            if self._batch_active and not self._cancelled and i < len(chapter_ids) - 1:
                import time
                time.sleep(1)
        
        # Batch complete
        if self._batch_active and not self._cancelled:
            if self.window_eval:
                self.window_eval(f"window.onBatchStatus({json.dumps({'status': 'done', 'completed': self._batch_completed, 'total': self._batch_total})})")
        
        self._batch_active = False
    
    def start_translation(
        self,
        series_id: str,
        chapter_id: str,
        progress_callback: Optional[Callable] = None
    ) -> threading.Thread:
        """
        Start translation in a separate thread
        
        Args:
            series_id: Series UUID
            chapter_id: Chapter UUID
            progress_callback: Optional callback for progress updates
            
        Returns:
            threading.Thread: The translation thread
        """
        # Start translation in background thread
        self._translation_thread = threading.Thread(
            target=self._translate,
            args=(series_id, chapter_id, progress_callback),
            daemon=True
        )
        self._translation_thread.start()
        return self._translation_thread
    
    def _translate(
        self,
        series_id: str,
        chapter_id: str,
        progress_callback: Optional[Callable] = None
    ):
        """
        Internal translation method (runs in separate thread)
        
        Args:
            series_id: Series UUID
            chapter_id: Chapter UUID
            progress_callback: Optional callback for progress updates
        """
        try:
            # Reset state
            self._cancelled = False
            self._total_tokens = 0
            self._iteration = 0
            
            # Get chapter data
            chapter = get_chapter(series_id, chapter_id)
            if chapter is None:
                self._send_error(f"Chapter {chapter_id} not found")
                return
            
            # Get series data for context
            series = get_series(series_id)
            if series is None:
                self._send_error(f"Series {series_id} not found")
                return
            
            raw_content = chapter.get("rawContent", "")
            
            # Update status to processing
            update_chapter_status(series_id, chapter_id, "processing")
            self._send_status("processing")
            
            # Build context window (Layer 1 + 2 + 3 + current content)
            context = build_context_window(
                series_id, chapter_id,
                llm_client=self.client,
                window_eval=self.window_eval
            )
            
            if context:
                # Use layered context in prompt
                # NOTE: context['system_context'] already includes rolling + memory
                # because build_context_window calls build_system_prompt(series) with them
                # But we need to rebuild with rolling+memory if they exist
                system_prompt = build_system_prompt(
                    series,
                    rolling_context=context.get("rolling_context", ""),
                    memory_context=context.get("memory_context", "")
                )
                # Use the raw content from context (in case of future pre-processing)
                user_prompt = build_user_prompt(
                    context.get("current_content", raw_content),
                    chapter,
                    series.get("targetLanguage", "Indonesian")
                )
                print(f"[Translator] Context window: {context['total_tokens']} tokens "
                      f"(system={context['tokens_breakdown']['system']}, "
                      f"rolling={context['tokens_breakdown']['rolling']}, "
                      f"memory={context['tokens_breakdown']['memory']}, "
                      f"current={context['tokens_breakdown']['current']})"
                      f"{' [COMPACTED]' if context.get('compacted') else ''}")
            else:
                # Fallback: build prompts without context window
                system_prompt = build_system_prompt(series)
                user_prompt = build_user_prompt(raw_content, chapter, series.get("targetLanguage", "Indonesian"))
            
            # Smart iteration - translate in chunks if needed
            full_translation = ""
            remaining_content = raw_content
            
            self._iteration = 0
            
            while remaining_content and not self._cancelled and self._iteration < 10:
                self._iteration += 1
                
                # Progress callback
                if progress_callback:
                    progress_callback({
                        "status": "processing",
                        "iteration": self._iteration,
                        "message": f"Translation iteration {self._iteration}..."
                    })
                
                # Prepare messages for this iteration
                is_continuation = self._iteration > 1
                
                target_lang = series.get("targetLanguage", "Indonesian")
                if is_continuation:
                    # For continuation, just send remaining content
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Continue translating to {target_lang}. Start immediately:\n\n{remaining_content}"}
                    ]
                else:
                    # First iteration
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ]
                
                # Stream translation
                chunk_text = self._stream_completion(
                    series_id,
                    chapter_id,
                    messages
                )
                
                if not chunk_text:
                    # Empty response, break
                    break
                
                # Append to full translation
                full_translation += chunk_text
                
                # Check if translation is complete
                if "[SELESAI]" in chunk_text or self._is_translation_complete(chunk_text):
                    # Remove [SELESAI] marker
                    full_translation = full_translation.replace("[SELESAI]", "")
                    break
                
                # Estimate remaining content (simple heuristic)
                # This is approximate - in production would use semantic matching
                remaining_content = self._estimate_remaining(raw_content, full_translation)
                
                # Update chapter with partial translation
                update_chapter_translation(series_id, chapter_id, full_translation)
            
            if self._cancelled:
                # Translation was cancelled
                self._send_status("cancelled")
                return
            
            # Translation complete!
            update_chapter_status(series_id, chapter_id, "done")
            update_chapter_translation(series_id, chapter_id, full_translation)
            update_translation_log(series_id, chapter_id, self._iteration, self._total_tokens)
            
            # Generate chapter summary for rolling context (Layer 2)
            self._send_status("summarizing")
            print(f"[Summary] Generating chapter summary...")
            try:
                summary = generate_chapter_summary(
                    self.client,
                    full_translation,
                    chapter.get("chapterNumber", 1),
                    chapter.get("title", "")
                )
                if summary:
                    update_chapter_summary(series_id, chapter_id, summary)
                    print(f"[Translator] Summary generated: {len(summary)} chars")
            except Exception as e:
                print(f"[Translator] Summary generation failed: {e}")
            
            # Run extraction pass (glossary auto-extract)
            self._send_status("extracting")
            print(f"[Glossary] Extracting terms from chapter...")
            try:
                glossary_updates = extract_glossary_terms(
                    self.client,
                    raw_content,
                    full_translation
                )
                # Save glossary updates to chapter
                from .storage.chapters import update_glossary_updates
                update_glossary_updates(series_id, chapter_id, glossary_updates)
            except Exception as e:
                print(f"Extraction failed: {e}")
                glossary_updates = {"extractedAt": None, "entries": []}

            term_count = len(glossary_updates.get("entries", []))
            print(f"[Glossary] Extracted {term_count} term(s)")

            # Final status update
            print(f"[✓] Translation complete — {self._iteration} iteration(s) | ~{self._total_tokens} tokens")
            self._send_status("done")
            self._send_result({
                "status": "done",
                "translation": full_translation,
                "iterations": self._iteration,
                "tokens": self._total_tokens,
                "glossaryUpdates": glossary_updates
            })
            
        except Exception as e:
            # Error occurred
            error_msg = str(e)
            print(f"Translation error: {error_msg}")
            self._send_error(error_msg)
            
            # Update chapter status to error
            try:
                update_chapter_status(series_id, chapter_id, "error")
            except:
                pass
    
    def _stream_completion(
        self,
        series_id: str,
        chapter_id: str,
        messages: List[Dict[str, str]]
    ) -> str:
        """
        Stream completion from LLM with real-time updates to frontend
        
        Args:
            series_id: Series UUID
            chapter_id: Chapter UUID
            messages: Chat messages
            
        Returns:
            str: Complete streamed text
        """
        full_text = ""
        
        # Get stream from client
        stream = self.client.complete(messages, stream=True, max_tokens=self.client.max_tokens)
        
        # Process stream
        t0 = time.time()
        for chunk in stream:
            if self._cancelled:
                break

            # Handle different provider response formats
            chunk_text = self._extract_chunk_text(chunk)

            if chunk_text:
                full_text += chunk_text
                self._total_tokens += 1  # Approximate token count

                # Stream to frontend in real-time
                self._send_chunk({
                    "chunk": chunk_text,
                    "iteration": self._iteration,
                    "fullText": full_text
                })

        elapsed = time.time() - t0
        print(f"[API ←] stream done in {elapsed:.1f}s | ~{len(full_text)} chars output")

        return full_text
    
    def _extract_chunk_text(self, chunk: Any) -> str:
        """
        Extract text from stream chunk
        
        Args:
            chunk: Stream chunk (varies by provider)
            
        Returns:
            str: Extracted text
        """
        try:
            # Handle ZhipuAI format
            if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content'):
                    return delta.content or ""
            
            # Handle Qwen format
            if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if isinstance(delta, dict):
                    return delta.get('content', '')
            
        except Exception as e:
            print(f"Error extracting chunk: {e}")
        
        return ""
    
    def _is_translation_complete(self, text: str) -> bool:
        """
        Check if translation appears complete
        
        Args:
            text: Translated text
            
        Returns:
            bool: True if translation appears complete
        """
        # Simple heuristic: ends with punctuation
        stripped = text.strip()
        if not stripped:
            return False
        
        # Check for common ending punctuation
        endings = ('.', '!', '?', '。', '！', '？')
        return stripped[-1] in endings
    
    def _estimate_remaining(self, raw: str, translated: str) -> str:
        """
        Estimate remaining content to translate
        
        Args:
            raw: Original raw content
            translated: Current translation
            
        Returns:
            str: Estimated remaining content
        """
        # Simple length-based estimation
        # This is approximate - in production would use more sophisticated matching
        ratio = len(translated) / max(len(raw), 1)
        
        if ratio >= 0.95:
            return ""  # Nearly complete
        
        # Estimate remaining portion
        remaining_chars = len(raw) - int(len(raw) * ratio * 0.8)
        return raw[-remaining_chars:] if remaining_chars > 0 else ""
    
    def _send_chunk(self, data: Dict[str, Any]):
        """Send chunk to frontend via evaluate_js"""
        if self.window_eval:
            js_code = f"window.onTranslationChunk({json.dumps(data)})"
            try:
                self.window_eval(js_code)
            except Exception as e:
                print(f"Error sending chunk: {e}")
    
    def _send_status(self, status: str):
        """Send status update to frontend"""
        if self.window_eval:
            data = {"status": status}
            js_code = f"window.onTranslationStatus({json.dumps(data)})"
            try:
                self.window_eval(js_code)
            except Exception as e:
                print(f"Error sending status: {e}")
    
    def _send_result(self, result: Dict[str, Any]):
        """Send final result to frontend"""
        if self.window_eval:
            js_code = f"window.onTranslationDone({json.dumps(result)})"
            try:
                self.window_eval(js_code)
            except Exception as e:
                print(f"Error sending result: {e}")
    
    def _send_error(self, error: str):
        """Send error to frontend"""
        if self.window_eval:
            data = {"error": True, "message": error}
            js_code = f"window.onTranslationError({json.dumps(data)})"
            try:
                self.window_eval(js_code)
            except Exception as e:
                print(f"Error sending error: {e}")