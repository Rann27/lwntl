"""
Translator Module - Smart Iteration + Streaming
Implements anti-truncation translation with real-time streaming per Section 8.4-8.5
"""

import threading
import json
import time
from typing import Dict, List, Any, Optional, Callable
from .llm_client import LLMClient
from .storage.series import get_series
from .storage.chapters import (
    update_chapter_status, update_chapter_translation,
    update_chapter_summary, update_translation_log, get_chapter
)
from .prompt_builder import build_system_prompt, build_user_prompt
from .extractor import extract_glossary_terms, parse_glossary_from_translation
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
        progress_callback: Optional[Callable] = None,
        force: bool = False,
    ) -> threading.Thread:
        """
        Start batch translation for multiple chapters in sequence.
        force=False: skip non-pending chapters (Translate All behaviour).
        force=True:  translate regardless of status (Translate Selected behaviour).
        """
        self._cancelled = False
        self._batch_active = True
        self._batch_total = len(chapter_ids)
        self._batch_completed = 0

        thread = threading.Thread(
            target=self._batch_translate,
            args=(series_id, chapter_ids, progress_callback, force),
            daemon=True
        )
        thread.start()
        return thread
    
    def _batch_translate(
        self,
        series_id: str,
        chapter_ids: List[str],
        progress_callback: Optional[Callable] = None,
        force: bool = False,
    ):
        """
        Translate chapters sequentially.
        force=False: skip non-pending (Translate All).
        force=True:  translate regardless of status (Translate Selected).
        After each chapter, auto-apply new glossary terms to the series glossary
        so subsequent chapters benefit from them immediately.
        """
        for i, chapter_id in enumerate(chapter_ids):
            if not self._batch_active or self._cancelled:
                if self.window_eval:
                    self.window_eval(f"window.onBatchStatus({json.dumps({'status': 'cancelled', 'completed': self._batch_completed, 'total': self._batch_total})})")
                break

            chapter = get_chapter(series_id, chapter_id)

            if not chapter:
                self._batch_completed += 1
                continue

            # Skip non-pending chapters unless force=True
            if not force and chapter.get("status") != "pending":
                self._batch_completed += 1
                continue

            # Send batch progress
            if self.window_eval:
                self.window_eval(f"window.onBatchStatus({json.dumps({'status': 'translating', 'current': i + 1, 'total': self._batch_total, 'chapterId': chapter_id, 'chapterNumber': chapter.get('chapterNumber', '?'), 'chapterTitle': chapter.get('title', '')})})")

            # Translate this chapter
            self._translate(series_id, chapter_id, progress_callback)

            # Auto-apply extracted glossary terms to series (cross-chapter awareness)
            self._auto_apply_glossary(series_id, chapter_id)

            self._batch_completed += 1

            # Small pause between chapters
            if self._batch_active and not self._cancelled and i < len(chapter_ids) - 1:
                time.sleep(1)

        # Batch complete
        if self._batch_active and not self._cancelled:
            if self.window_eval:
                self.window_eval(f"window.onBatchStatus({json.dumps({'status': 'done', 'completed': self._batch_completed, 'total': self._batch_total})})")

        self._batch_active = False

    def _auto_apply_glossary(self, series_id: str, chapter_id: str):
        """
        After a chapter is translated, auto-apply its extracted glossary terms
        to the series glossary — skipping any term whose sourceTerm already exists
        (case-insensitive). This gives the next chapter in the batch up-to-date context.
        """
        from .storage.series import get_series, add_glossary_entry
        try:
            chapter = get_chapter(series_id, chapter_id)
            if not chapter or chapter.get("status") != "done":
                return
            glossary_updates = chapter.get("glossaryUpdates") or {}
            new_entries = glossary_updates.get("entries", [])
            if not new_entries:
                return

            series = get_series(series_id)
            current = series.get("glossary", []) if series else []
            existing = {e.get("sourceTerm", "").lower().strip() for e in current}

            added = 0
            for entry in new_entries:
                src = (entry.get("sourceTerm") or "").strip()
                if src and src.lower() not in existing:
                    add_glossary_entry(
                        series_id,
                        src,
                        entry.get("translatedTerm", ""),
                        entry.get("notes", ""),
                    )
                    existing.add(src.lower())
                    added += 1

            if added:
                print(f"[Glossary] Auto-applied {added} new term(s) from chapter {chapter_id}")
        except Exception as e:
            print(f"[Glossary] Auto-apply error: {e}")
    
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
        self._cancelled = False
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
            # Reset counters (cancelled flag is set by caller before thread starts)
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

                # Empty stream output — retry with non-stream fallback.
                # Thinking-mode models (GLM-5.1 coding, etc.) can consume the entire
                # token budget on reasoning and produce 0 content chars.
                if not chunk_text:
                    print(f"[Translator] Empty stream output (iteration {self._iteration}), trying non-stream fallback...")
                    chunk_text = self._sync_completion(
                        messages,
                        max_tokens=min(self.client.max_tokens, 16000)
                    )
                    if chunk_text:
                        print(f"[Translator] Fallback succeeded: {len(chunk_text)} chars")
                        self._total_tokens += max(1, len(chunk_text) // 4)
                        self._send_chunk({
                            "chunk": chunk_text,
                            "iteration": self._iteration,
                            "fullText": full_translation + chunk_text
                        })
                    else:
                        print("[Translator] Fallback also returned empty")
                
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

            # Do not continue with summary/extraction if main translation is empty
            # or suspiciously short compared to raw content (thinking-mode models
            # can return near-empty output after minutes of reasoning).
            raw_len = len(raw_content.strip()) if raw_content else 0
            trans_len = len(full_translation.strip())
            if trans_len == 0:
                err = "Translation returned empty output from provider"
                print(f"[Translator] {err}")
                update_chapter_status(series_id, chapter_id, "error")
                self._send_error(err)
                return
            if raw_len > 500 and trans_len < raw_len * 0.05:
                print(f"[Translator] WARNING: Translation suspiciously short ({trans_len} chars vs {raw_len} chars raw). Possible thinking-mode output.")
                # Still continue — might be valid short translation
            
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
            
            # Glossary extraction — parse table from translation output first.
            # Models instructed to append a markdown glossary table incur zero
            # extra API calls this way.  Fall back to a separate LLM extraction
            # call only when the table is absent (custom prompt without that rule).
            self._send_status("extracting")
            try:
                glossary_updates = parse_glossary_from_translation(full_translation)

                if not glossary_updates.get("entries"):
                    print("[Glossary] No table found in translation — falling back to LLM extraction...")
                    glossary_updates = extract_glossary_terms(
                        self.client, raw_content, full_translation
                    )
                else:
                    print(f"[Glossary] {len(glossary_updates['entries'])} term(s) parsed from translation table (no extra API call)")

                from .storage.chapters import update_glossary_updates
                update_glossary_updates(series_id, chapter_id, glossary_updates)
            except Exception as e:
                print(f"[Glossary] Extraction failed: {e}")
                glossary_updates = {"extractedAt": None, "entries": []}

            term_count = len(glossary_updates.get("entries", []))
            print(f"[Glossary] Extracted {term_count} term(s)")

            # Final status update
            raw_len = len(raw_content) if raw_content else 0
            trans_len = len(full_translation)
            print(f"[✓] Translation complete — {self._iteration} iteration(s) | ~{self._total_tokens} tokens | {raw_len} → {trans_len} chars")
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

        # Batch settings: flush to frontend every ~80 chars OR every 120ms.
        # Without batching, every single token triggers a synchronous Control.Invoke()
        # on the Windows Forms UI thread, which saturates it and causes the app to freeze.
        BATCH_CHARS = 80
        BATCH_SECS  = 0.12
        _buf = ""
        _last_flush = time.time()

        t0 = time.time()
        first_token_at = None
        thinking_chars = 0

        for chunk in stream:
            if self._cancelled:
                break

            # Track thinking tokens (models with reasoning mode)
            if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                rc = getattr(delta, 'reasoning_content', None)
                if rc:
                    thinking_chars += len(rc)
                    if first_token_at is None:
                        first_token_at = time.time()
                        print(f"[API ←] TTFT (thinking): {first_token_at - t0:.2f}s")

            chunk_text = self._extract_chunk_text(chunk)

            if chunk_text:
                if first_token_at is None:
                    first_token_at = time.time()
                    print(f"[API ←] TTFT: {first_token_at - t0:.2f}s")

                full_text += chunk_text
                self._total_tokens += 1
                _buf += chunk_text

                now = time.time()
                if len(_buf) >= BATCH_CHARS or (now - _last_flush) >= BATCH_SECS:
                    self._send_chunk({
                        "chunk": _buf,
                        "iteration": self._iteration,
                        "fullText": full_text,
                    })
                    _buf = ""
                    _last_flush = now

        # Flush remaining buffer
        if _buf:
            self._send_chunk({
                "chunk": _buf,
                "iteration": self._iteration,
                "fullText": full_text,
            })

        elapsed = time.time() - t0
        if first_token_at is None:
            print("[API ←] stream ended without output tokens")
        if thinking_chars > 0:
            print(f"[API ←] thinking: {thinking_chars} chars | content: {len(full_text)} chars")
        print(f"[API ←] stream done in {elapsed:.1f}s | ~{len(full_text)} chars output")

        return full_text

    def _sync_completion(self, messages: List[Dict[str, str]], max_tokens: int) -> str:
        """Fallback completion path (non-stream) for providers that return empty streams."""
        try:
            # Inject a direct-output instruction to bypass thinking mode
            fallback_messages = list(messages)
            if fallback_messages:
                last = fallback_messages[-1]
                fallback_messages[-1] = {
                    "role": last["role"],
                    "content": (
                        "IMPORTANT: Output your translation directly. "
                        "Do NOT think, reason, or explain. Just translate.\n\n"
                        + last.get("content", "")
                    ),
                }

            response = self.client.complete(
                fallback_messages,
                stream=False,
                max_tokens=max_tokens,
            )
            text = self._extract_response_text(response)
            if text:
                print(f"[Translator] Non-stream fallback returned {len(text)} chars")
            else:
                # Check if response had reasoning but no content (thinking mode)
                if hasattr(response, 'choices') and response.choices:
                    msg = response.choices[0].message if hasattr(response.choices[0], 'message') else None
                    if msg:
                        rc = getattr(msg, 'reasoning_content', None)
                        if rc:
                            print(f"[Translator] Non-stream fallback: model produced {len(rc)} chars of reasoning but 0 chars of content")
            return text
        except Exception as e:
            print(f"[Translator] Non-stream fallback failed: {e}")
            return ""

    def _extract_response_text(self, response: Any) -> str:
        """Extract text from non-stream completion response."""
        try:
            if not (hasattr(response, "choices") and response.choices):
                return ""

            choice = response.choices[0]
            if not hasattr(choice, "message"):
                return ""

            content = getattr(choice.message, "content", "")
            if isinstance(content, str):
                return content

            # Some OpenAI-compatible servers can return content parts.
            if isinstance(content, list):
                parts: List[str] = []
                for item in content:
                    if isinstance(item, str):
                        parts.append(item)
                    elif isinstance(item, dict):
                        text = item.get("text") or item.get("content") or ""
                        if text:
                            parts.append(str(text))
                return "".join(parts)

        except Exception as e:
            print(f"[Translator] Failed to extract non-stream response text: {e}")

        return ""
    
    # Debug: log raw chunk structure once for empty extractions
    _chunk_debug_logged = False

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
                if hasattr(delta, 'content') and delta.content:
                    return delta.content
                if hasattr(delta, 'content') and delta.content is None:
                    # Content is None — likely a thinking-mode chunk
                    return ""

            # Handle Qwen format
            if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if isinstance(delta, dict):
                    return delta.get('content', '') or ""

            # Debug: if we got here, standard extraction failed.
            # Log the raw chunk structure ONCE to help diagnose format mismatches.
            if not Translator._chunk_debug_logged:
                Translator._chunk_debug_logged = True
                try:
                    attrs = {k: type(v).__name__ for k, v in vars(chunk).items()} if hasattr(chunk, '__dict__') else str(type(chunk))
                    print(f"[DEBUG] Unhandled chunk format: {attrs}")
                    if hasattr(chunk, 'choices') and chunk.choices:
                        c0 = chunk.choices[0]
                        if hasattr(c0, 'delta'):
                            d = c0.delta
                            d_attrs = {k: (repr(v)[:80] if v else str(v)) for k, v in vars(d).items()} if hasattr(d, '__dict__') else str(type(d))
                            print(f"[DEBUG] delta fields: {d_attrs}")
                except Exception:
                    pass

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