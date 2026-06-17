"""
PyWebView API Bindings
This file contains all the methods exposed to frontend
"""

import json
from core.storage.config import get_config, save_config, init_config, update_config
from core.storage.series import (
    get_all_series, create_series, update_series as update_series_db,
    get_series, get_series_delete_info, delete_series,
    save_instructions, add_glossary_entry, update_glossary_entry, delete_glossary_entry,
    move_series_to_group as move_series_to_group_db,
)
from core.storage.groups import (
    get_all_groups, create_group as create_group_db,
    update_group as update_group_db, delete_group as delete_group_db,
)
from core.storage.chapters import (
    get_chapters, create_chapter, update_chapter as update_chapter_db,
    get_chapter, get_chapter_delete_info, delete_chapter,
    update_chapter_status, update_chapter_translation, update_chapter_summary,
    update_glossary_updates, update_translation_log,
    restore_translation_version as restore_version_db,
)
from core.llm_client import LLMClient, test_client as test_llm_client
from core.worker_manager import WorkerManager
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
        self._worker_manager = WorkerManager(window.evaluate_js if window else None)
    
    def set_window(self, window):
        """Set window reference after creation"""
        self._window = window
        self._worker_manager.set_window_eval(window.evaluate_js if window else None)
    
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
            self._worker_manager.set_window_eval(self._window.evaluate_js if self._window else None)
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

    # Groups CRUD
    def get_groups(self):
        try:
            return get_all_groups()
        except Exception as e:
            return {"error": True, "message": str(e)}

    def create_group(self, name: str, parent_id: str = None, color: str = ''):
        try:
            return create_group_db(name, parent_id or None, color)
        except (ValueError, FileNotFoundError) as e:
            return {"error": True, "message": str(e)}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def update_group(self, group_id: str, name: str = None, color: str = None):
        try:
            return update_group_db(group_id, name, color)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def delete_group(self, group_id: str):
        """Delete group; child groups and series are re-parented to the deleted group's parent."""
        try:
            parent_id = delete_group_db(group_id)
            # Re-parent series that were in this group
            for s in get_all_series():
                if s.get('groupId') == group_id:
                    move_series_to_group_db(s['id'], parent_id)
            return True
        except Exception as e:
            return {"error": True, "message": str(e)}

    def move_series_to_group(self, series_id: str, group_id: str = None):
        try:
            return move_series_to_group_db(series_id, group_id or None)
        except Exception as e:
            return {"error": True, "message": str(e)}

    # Series CRUD
    def get_all_series(self):
        """Get all series"""
        try:
            series = get_all_series()
            for item in series:
                item.setdefault("workerId", "")
            return series
        except Exception as e:
            print(f"[API] get_all_series error: {e}")
            return {"error": True, "message": str(e)}

    def create_series(self, title: str, language: str, target_language: str = "Indonesian"):
        """Create a new series"""
        try:
            return create_series(title, language, target_language)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def update_series(self, series_id: str, title: str, language: str,
                      target_language: str = None, system_prompt: str = None,
                      worker_id: str = None):
        """Update a series"""
        try:
            return update_series_db(series_id, title, language, target_language, system_prompt, worker_id)
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

    def create_chapter(self, series_id: str, number: str, title: str, raw_content: str):
        """Create a new chapter"""
        try:
            return create_chapter(series_id, str(number), title, raw_content)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def update_chapter(self, series_id: str, chapter_id: str, number: str, title: str, raw_content: str):
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
    def start_translation(self, series_id: str, chapter_id: str, archive_previous: bool = False):
        """Start translating a chapter. archive_previous=True saves current translation to history first."""
        try:
            return self._worker_manager.start_translation(
                series_id,
                chapter_id,
                archive_previous=bool(archive_previous),
            )
        except Exception as e:
            return {"error": True, "message": str(e)}

    def cancel_translation(self, series_id: str = None, worker_id: str = None):
        """Cancel ongoing translation (including batch)"""
        try:
            return self._worker_manager.cancel(series_id=series_id, worker_id=worker_id)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    def restore_translation_version(self, series_id: str, chapter_id: str, version_index: int):
        """Restore a previous translation version by index (0 = most recent previous)."""
        try:
            chapter = restore_version_db(series_id, chapter_id, int(version_index))
            return chapter
        except Exception as e:
            return {"error": True, "message": str(e)}

    def start_batch_translation(self, series_id: str, chapter_ids: str, force: bool = False, archive_previous: bool = False):
        """
        Start batch translation.
        force=False: only pending chapters (Translate All).
        force=True:  translate regardless of status (Translate Selected).
        archive_previous: archive existing translation before overwriting.
        """
        try:
            ids = json.loads(chapter_ids) if isinstance(chapter_ids, str) else chapter_ids
            return self._worker_manager.start_batch_translation(
                series_id,
                ids,
                force=bool(force),
                archive_previous=bool(archive_previous),
            )
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_worker_statuses(self):
        """Get worker profiles with runtime and assignment status."""
        try:
            return self._worker_manager.get_statuses()
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_series_logs(self, series_id: str):
        """Get in-memory logs for a specific series."""
        try:
            return self._worker_manager.get_series_logs(series_id)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_worker_logs(self, worker_id: str = None):
        """Get in-memory worker logs."""
        try:
            return self._worker_manager.get_logs(worker_id if worker_id and worker_id != "all" else None)
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

    def parse_document(self, filename: str, data_base64: str, mode: str = 'standard'):
        """Parse a .docx or .pdf file and return markdown content.
        mode: 'standard' (default) or 'flow' (paragraph reconstruction for line-break PDFs).
        """
        try:
            import base64
            from core.document_parser import parse_docx, parse_pdf, parse_pdf_flow
            data = base64.b64decode(data_base64)
            ext = filename.lower().rsplit('.', 1)[-1]
            if ext == 'docx':
                return parse_docx(data, filename)
            elif ext == 'pdf':
                if mode == 'flow':
                    return parse_pdf_flow(data, filename)
                return parse_pdf(data, filename)
            else:
                return {"error": True, "message": f"Format tidak didukung: {ext}"}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def export_glossary_file(self, series_id: str, fmt: str, data: str):
        """Export glossary as JSON or CSV via native save dialog."""
        try:
            import webview
            series = get_series(series_id)
            safe_title = (series.get("title", "glossary") if series else "glossary").replace("/", "-").replace("\\", "-")[:40]
            ext = "csv" if fmt == "csv" else "json"
            filename = f"glossary-{safe_title}.{ext}"

            if fmt == "csv":
                file_types = ("CSV File (*.csv)",)
            else:
                file_types = ("JSON File (*.json)",)

            result = self._window.create_file_dialog(
                webview.SAVE_DIALOG,
                directory="",
                save_filename=filename,
                file_types=file_types,
            )
            if not result:
                return {"error": False, "cancelled": True}

            save_path = result[0] if isinstance(result, (list, tuple)) else result
            if not save_path.endswith(f".{ext}"):
                save_path += f".{ext}"

            with open(save_path, "w", encoding="utf-8") as f:
                f.write(data)

            print(f"[Export] Glossary saved to: {save_path}")
            return {"error": False, "message": f"Glossary berhasil diekspor!", "path": save_path}
        except Exception as e:
            print(f"[Export] Glossary error: {e}")
            return {"error": True, "message": str(e)}

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

    def export_series_merged(self, series_id: str):
        """Export all done chapters in a series into a single merged .docx (with template if available)."""
        try:
            import webview
            from core.exporter import export_series_to_docx
            from core.storage.chapters import get_chapters as _get_chapters, chapter_num_float

            series   = get_series(series_id)
            chapters = _get_chapters(series_id)

            if not series:
                return {"error": True, "message": "Series tidak ditemukan"}

            done = [c for c in chapters if c.get("status") == "done" and c.get("translatedContent", "").strip()]
            if not done:
                return {"error": True, "message": "Tidak ada bab yang sudah diterjemahkan"}

            done.sort(key=lambda c: chapter_num_float(c.get("chapterNumber", 0)))

            safe_title = (series.get("title", "series") or "series").replace("\\", "-").replace("/", "-")[:50]
            default_name = f"{safe_title} - Complete.docx"

            result = self._window.create_file_dialog(
                webview.SAVE_DIALOG,
                directory="",
                save_filename=default_name,
                file_types=("Word Document (*.docx)",),
            )
            if not result:
                return {"error": False, "cancelled": True, "message": "Dibatalkan"}

            save_path = result if isinstance(result, str) else result[0]
            if not save_path.lower().endswith('.docx'):
                save_path += '.docx'

            docx_bytes, used_template = export_series_to_docx(series, done)
            with open(save_path, "wb") as f:
                f.write(docx_bytes)

            tpl_note = " (dengan template)" if used_template else ""
            print(f"[Export] Merged {len(done)} chapters → {save_path}{tpl_note}")
            return {"error": False, "message": f"{len(done)} bab diekspor{tpl_note}!", "path": save_path, "usedTemplate": used_template}

        except Exception as e:
            print(f"[Export] Merged error: {e}")
            import traceback; traceback.print_exc()
            return {"error": True, "message": str(e)}
