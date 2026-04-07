"""
PyWebView API Bindings
This file contains all the methods exposed to frontend
"""

import json
from core.storage.config import get_config, save_config, init_config, update_config
from core.storage.series import (
    get_all_series, create_series, update_series as update_series_db,
    get_series, get_series_delete_info, delete_series,
    save_instructions, add_glossary_entry, update_glossary_entry, delete_glossary_entry
)
from core.storage.chapters import (
    get_chapters, create_chapter, update_chapter as update_chapter_db,
    get_chapter, get_chapter_delete_info, delete_chapter,
    update_chapter_status, update_chapter_translation, update_chapter_summary,
    update_glossary_updates, update_translation_log
)
from core.llm_client import LLMClient, test_client as test_llm_client
from core.translator import Translator
from core.context_window import get_context_info, invalidate_context_cache, estimate_tokens


class API:
    def __init__(self, window=None):
        # Initialize config on first run
        try:
            init_config()
        except Exception as e:
            print(f"Error initializing config: {e}")
        
        # Store window reference for evaluate_js (use private to avoid pywebview serialization)
        self._window = window
        
        # Initialize LLM client and translator (lazy, on first use)
        self._llm_client = None
        self._translator = None
    
    def set_window(self, window):
        """Set window reference after creation"""
        self._window = window
    
    def _get_config(self):
        """Get current config"""
        try:
            return get_config()
        except FileNotFoundError:
            return init_config()
    
    def _get_llm_client(self):
        """Get or create LLM client"""
        if self._llm_client is None:
            config = self._get_config()
            self._llm_client = LLMClient(config)
        return self._llm_client
    
    def _get_translator(self):
        """Get or create translator"""
        if self._translator is None:
            client = self._get_llm_client()
            # Use window.evaluate_js for streaming
            window_eval = self._window.evaluate_js if self._window else None
            self._translator = Translator(client, window_eval=window_eval)
        else:
            # Update window reference in case it was set after init
            if self._window:
                self._translator.window_eval = self._window.evaluate_js
        return self._translator

    # Test method
    def ping(self):
        """Test method to verify PyWebView API connection"""
        return {"status": "pong", "message": "PyWebView API is working!"}

    # Config
    def get_config(self):
        """Get application configuration"""
        try:
            return get_config()
        except FileNotFoundError:
            return init_config()
        except Exception as e:
            return {"error": True, "message": str(e)}

    def save_config(self, config: dict):
        """Save application configuration"""
        try:
            save_config(config)
            # Reinitialize LLM client with new config
            self._llm_client = None
            self._translator = None
            return True
        except Exception as e:
            return {"error": True, "message": str(e)}

    def test_config(self):
        """Test if LLM client can connect with current config"""
        try:
            config = self._get_config()
            result = test_llm_client(config)
            return result
        except Exception as e:
            return {"success": False, "message": "Test failed", "error": str(e)}

    # Series CRUD
    def get_all_series(self):
        """Get all series"""
        try:
            return get_all_series()
        except Exception as e:
            return {"error": True, "message": str(e)}

    def create_series(self, title: str, language: str, target_language: str = "Indonesian"):
        """Create a new series"""
        try:
            return create_series(title, language, target_language)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def update_series(self, series_id: str, title: str, language: str, 
                      target_language: str = None, system_prompt: str = None):
        """Update a series"""
        try:
            return update_series_db(series_id, title, language, target_language, system_prompt)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    def get_default_system_prompt(self, target_language: str):
        """Get default system prompt for a target language"""
        try:
            from core.prompt_builder import get_default_system_prompt
            return {"prompt": get_default_system_prompt(target_language)}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_series_delete_info(self, series_id: str):
        """Get information about what will be deleted"""
        try:
            return get_series_delete_info(series_id)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def delete_series(self, series_id: str):
        """Delete a series (cascade delete)"""
        try:
            delete_series(series_id)
            return True
        except Exception as e:
            return {"error": True, "message": str(e)}

    # Chapter CRUD
    def get_chapters(self, series_id: str):
        """Get all chapters for a series"""
        try:
            return get_chapters(series_id)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def create_chapter(self, series_id: str, number: int, title: str, raw_content: str):
        """Create a new chapter"""
        try:
            return create_chapter(series_id, number, title, raw_content)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def update_chapter(self, series_id: str, chapter_id: str, number: int, title: str, raw_content: str):
        """Update a chapter"""
        try:
            return update_chapter_db(series_id, chapter_id, number, title, raw_content)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_chapter(self, series_id: str, chapter_id: str):
        """Get a specific chapter"""
        try:
            return get_chapter(series_id, chapter_id)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_chapter_delete_info(self, series_id: str, chapter_id: str):
        """Get information about what will be deleted"""
        try:
            return get_chapter_delete_info(series_id, chapter_id)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def delete_chapter(self, series_id: str, chapter_id: str):
        """Delete a chapter"""
        try:
            delete_chapter(series_id, chapter_id)
            return True
        except Exception as e:
            return {"error": True, "message": str(e)}

    # Glossary CRUD
    def get_glossary(self, series_id: str):
        """Get glossary for a series"""
        try:
            series = get_series(series_id)
            if series is None:
                return {"error": True, "message": "Series not found"}
            return series.get("glossary", [])
        except Exception as e:
            return {"error": True, "message": str(e)}

    def add_glossary_entry(self, series_id: str, source_term: str, translated_term: str, notes: str):
        """Add a glossary entry"""
        try:
            return add_glossary_entry(series_id, source_term, translated_term, notes)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def update_glossary_entry(self, series_id: str, entry_id: str, source_term: str, translated_term: str, notes: str):
        """Update a glossary entry"""
        try:
            return update_glossary_entry(series_id, entry_id, source_term, translated_term, notes)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def delete_glossary_entry(self, series_id: str, entry_id: str):
        """Delete a glossary entry"""
        try:
            delete_glossary_entry(series_id, entry_id)
            return True
        except Exception as e:
            return {"error": True, "message": str(e)}

    # Instructions
    def save_instructions(self, series_id: str, instructions: str):
        """Save series instructions"""
        try:
            save_instructions(series_id, instructions)
            return True
        except Exception as e:
            return {"error": True, "message": str(e)}

    # Translation
    def start_translation(self, series_id: str, chapter_id: str):
        """Start translating a chapter"""
        try:
            translator = self._get_translator()
            translator.start_translation(series_id, chapter_id)
            return {"status": "started"}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def cancel_translation(self):
        """Cancel ongoing translation (including batch)"""
        try:
            translator = self._get_translator()
            return translator.cancel()
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    def start_batch_translation(self, series_id: str, chapter_ids: str):
        """Start batch translation for multiple chapters (JSON string of IDs). Only pending chapters."""
        try:
            ids = json.loads(chapter_ids) if isinstance(chapter_ids, str) else chapter_ids
            translator = self._get_translator()
            translator.start_batch_translation(series_id, ids)
            return {"status": "started", "total": len(ids)}
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    def get_context_info(self, series_id: str, chapter_id: str):
        """Get token breakdown for a chapter's context window"""
        try:
            return get_context_info(series_id, chapter_id)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    def invalidate_context_cache(self, series_id: str):
        """Invalidate cached contexts for a series"""
        try:
            invalidate_context_cache(series_id)
            return True
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    def estimate_tokens(self, text: str):
        """Estimate token count for text"""
        return {"tokens": estimate_tokens(text)}

    def export_chapter(self, series_id: str, chapter_id: str):
        """Export a translated chapter to .docx via save dialog."""
        try:
            import webview
            from core.exporter import export_chapter_to_docx

            chapter = get_chapter(series_id, chapter_id)
            series  = get_series(series_id)

            if not chapter or not series:
                return {"error": True, "message": "Data tidak ditemukan"}

            if not chapter.get("translatedContent", "").strip():
                return {"error": True, "message": "Bab belum diterjemahkan"}

            # Build a clean default filename
            num   = chapter.get("chapterNumber", 1)
            title = chapter.get("title", "").strip()
            safe_title = title.replace("/", "-").replace("\\", "-")[:60] if title else ""
            filename = f"Bab {num}"
            if safe_title:
                filename += f" - {safe_title}"
            filename += ".docx"

            # Show native save dialog
            result = self._window.create_file_dialog(
                webview.SAVE_DIALOG,
                directory="",
                save_filename=filename,
                file_types=("Word Document (*.docx)",),
            )

            if not result:
                return {"error": False, "cancelled": True, "message": "Dibatalkan"}

            save_path = result[0] if isinstance(result, (list, tuple)) else result
            if not save_path.endswith(".docx"):
                save_path += ".docx"

            # Generate and write
            docx_bytes = export_chapter_to_docx(series, chapter)
            with open(save_path, "wb") as f:
                f.write(docx_bytes)

            print(f"[Export] Chapter saved to: {save_path}")
            return {"error": False, "message": f"Berhasil diekspor!", "path": save_path}

        except Exception as e:
            print(f"[Export] Error: {e}")
            return {"error": True, "message": str(e)}

    def export_series(self, series_id: str):
        """Export all done chapters in a series to separate .docx files."""
        try:
            import webview
            from core.exporter import export_chapter_to_docx

            series   = get_series(series_id)
            chapters = get_chapters(series_id)

            if not series:
                return {"error": True, "message": "Series tidak ditemukan"}

            done = [c for c in chapters if c.get("status") == "done" and c.get("translatedContent", "").strip()]
            if not done:
                return {"error": True, "message": "Tidak ada bab yang sudah diterjemahkan"}

            # Ask for output directory
            result = self._window.create_file_dialog(
                webview.FOLDER_DIALOG,
                directory="",
            )
            if not result:
                return {"error": False, "cancelled": True, "message": "Dibatalkan"}

            folder = result[0] if isinstance(result, (list, tuple)) else result
            exported = 0
            for ch in sorted(done, key=lambda c: c.get("chapterNumber", 0)):
                num   = ch.get("chapterNumber", 0)
                title = ch.get("title", "").strip()
                safe_title = title.replace("/", "-").replace("\\", "-")[:60] if title else ""
                fname = f"Bab {num}"
                if safe_title:
                    fname += f" - {safe_title}"
                fname += ".docx"

                path = f"{folder}/{fname}"
                docx_bytes = export_chapter_to_docx(series, ch)
                with open(path, "wb") as f:
                    f.write(docx_bytes)
                exported += 1

            print(f"[Export] {exported} chapters exported to: {folder}")
            return {"error": False, "message": f"{exported} bab berhasil diekspor!", "path": folder}

        except Exception as e:
            print(f"[Export] Error: {e}")
            return {"error": True, "message": str(e)}