"""
PyWebView API Bindings
This file contains all the methods exposed to frontend
"""

import json
from core.storage.config import (
    get_config, save_config, init_config, update_config,
    get_all_profiles, get_active_profile_name,
    create_profile, delete_profile, rename_profile, switch_profile,
)
from core.storage.templates import get_profile_templates, save_profile_templates
from core.storage.series import (
    get_all_series, create_series, update_series as update_series_db,
    get_series, get_series_delete_info, delete_series,
    save_instructions, add_glossary_entry, update_glossary_entry, delete_glossary_entry,
    add_glossary_alias, remove_glossary_alias,
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
    get_chapter_assets as get_chapter_assets_db,
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

    # Profiles
    def get_profiles(self):
        try:
            return {"active": get_active_profile_name(), "profiles": get_all_profiles()}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def create_profile(self, name: str):
        try:
            return create_profile(name)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def delete_profile(self, name: str):
        try:
            return delete_profile(name)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def rename_profile(self, old_name: str, new_name: str):
        try:
            return rename_profile(old_name, new_name)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def switch_profile(self, name: str):
        try:
            switch_profile(name)
            return {"active": name, "profiles": get_all_profiles()}
        except Exception as e:
            return {"error": True, "message": str(e)}

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

    def get_openrouter_models(self, force: bool = False):
        """OpenRouter catalog for the model picker (cached for a day; force refetches)."""
        try:
            from core.openrouter import compact_catalog
            return compact_catalog(bool(force))
        except Exception as e:
            return {"error": True, "message": f"Gagal memuat katalog OpenRouter: {e}"}

    def list_provider_models(self, provider: str, refresh: bool = False):
        """A provider's model list fetched from the provider (cached a day; built-in list as fallback)."""
        try:
            from core.model_catalog import list_models
            return list_models(provider, get_config(), bool(refresh))
        except Exception as e:
            return {"error": True, "message": str(e)}

    # ChatGPT plan (Sign in with ChatGPT — official token sharing for local open-source apps)
    def chatgpt_status(self):
        try:
            from core.chatgpt_auth import status
            return status()
        except Exception as e:
            return {"error": True, "message": str(e)}

    def chatgpt_login(self):
        """Open the ChatGPT sign-in in the system browser; poll chatgpt_status for the result."""
        try:
            from core.chatgpt_auth import start_login
            return start_login()
        except Exception as e:
            return {"error": True, "message": str(e)}

    def chatgpt_cancel_login(self):
        try:
            from core.chatgpt_auth import cancel_login
            return cancel_login()
        except Exception as e:
            return {"error": True, "message": str(e)}

    def chatgpt_disconnect(self):
        try:
            from core.chatgpt_auth import disconnect
            return disconnect()
        except Exception as e:
            return {"error": True, "message": str(e)}

    def describe_request_params(self, provider: str, model: str):
        """What LWNTL will actually send for this provider + model, with the reasons."""
        try:
            from core.llm_client import request_profile
            prof = request_profile(self._get_config(), provider, model)
            body = dict(prof["extra_body"] or {})
            body.pop("google", None)  # safety settings are shown by their own toggle
            return {"temperature": prof["temperature"], "maxTokensKey": prof["max_tokens_key"],
                    "extra": body, "notes": prof["notes"]}
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
                      worker_id: str = None, iteration_lock=None, auto_fix_cjk=None,
                      image_folder=None, revision_pass=None,
                      lookup_enabled=None, lookup_chapters=None, system_prompt_preset=None):
        """Update a series"""
        try:
            lock = bool(iteration_lock) if iteration_lock is not None else None
            autofix = bool(auto_fix_cjk) if auto_fix_cjk is not None else None
            folder = str(image_folder) if image_folder is not None else None
            revision = bool(revision_pass) if revision_pass is not None else None
            lookup_on = bool(lookup_enabled) if lookup_enabled is not None else None
            lookup_n = int(lookup_chapters) if lookup_chapters is not None else None
            preset = str(system_prompt_preset) if system_prompt_preset is not None else None
            return update_series_db(series_id, title, language, target_language, system_prompt,
                                    worker_id, lock, autofix, folder, revision,
                                    lookup_on, lookup_n, preset)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    def get_default_system_prompt(self, target_language: str = None):
        """Get the active profile's system prompt template."""
        try:
            return {"prompt": get_profile_templates().get("systemPromptTemplate", "")}
        except Exception as e:
            return {"error": True, "message": str(e)}

    # Prompt presets (built-in per language pair + the user's own)
    def list_prompt_presets(self, with_text: bool = False):
        """Built-in and user prompt presets."""
        try:
            from core.prompt_presets import list_presets
            return list_presets(with_text=bool(with_text))
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_prompt_preset(self, preset_id: str):
        """One preset with its text."""
        try:
            from core.prompt_presets import get_preset
            p = get_preset(preset_id)
            return p if p else {"error": True, "message": "Preset tidak ditemukan"}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def duplicate_prompt_preset(self, preset_id: str, name: str = ""):
        """Copy a preset (built-in or user) into a new editable user preset."""
        try:
            from core.prompt_presets import duplicate_preset
            return duplicate_preset(preset_id, name or "")
        except Exception as e:
            return {"error": True, "message": str(e)}

    def save_prompt_preset(self, preset_id: str, name: str, text: str):
        """Rename / rewrite a user preset."""
        try:
            from core.prompt_presets import save_user_preset
            return save_user_preset(preset_id, name, text)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def delete_prompt_preset(self, preset_id: str):
        """Delete a user preset."""
        try:
            from core.prompt_presets import delete_user_preset
            return delete_user_preset(preset_id)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def resolve_series_prompt(self, series_id: str):
        """Which system prompt a series will use and where it comes from (text included)."""
        try:
            from core.prompt_builder import resolve_system_prompt
            series = get_series(series_id)
            if not series:
                return {"error": True, "message": "Series tidak ditemukan"}
            return resolve_system_prompt(series)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_profile_templates(self):
        """Get the active profile's prompt templates."""
        try:
            return get_profile_templates()
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_default_task_prompts(self):
        """Built-in guidance for the revision / autofix / pre-pass prompts, per language (en, id)."""
        try:
            from core.task_prompts import all_defaults
            return all_defaults()
        except Exception as e:
            return {"error": True, "message": str(e)}

    def save_profile_templates(self, system_prompt_template: str, instructions_template: str,
                               revision_prompt_template: str = None,
                               autofix_prompt_template: str = None,
                               prepass_prompt_template: str = None,
                               system_prompt_preset: str = None):
        """Save prompt templates for the active profile."""
        try:
            return save_profile_templates(system_prompt_template, instructions_template,
                                          revision_prompt_template=revision_prompt_template,
                                          autofix_prompt_template=autofix_prompt_template,
                                          prepass_prompt_template=prepass_prompt_template,
                                          system_prompt_preset=system_prompt_preset)
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

    def create_chapter(self, series_id: str, number: str, title: str, raw_content: str, images=None):
        """Create a new chapter. Optional images: [{filename, mime, data(base64)}] from import."""
        try:
            chapter = create_chapter(series_id, str(number), title, raw_content, images=images)
            # TXT/MD/manual chapters carry placeholder lines but no image bytes.
            # When the series has an image source, resolve them now — scoped to this
            # chapter so a bulk import does not rescan the whole series each time.
            try:
                from core.image_sync import (
                    sync_series_images as _sync, list_folder_images, get_series_image_pool,
                )
                series = get_series(series_id)
                folder = (series or {}).get("imageFolder", "").strip()
                has_source = bool(list_folder_images(folder)) or bool(
                    list_folder_images(str(get_series_image_pool(series_id)))
                )
                if has_source:
                    _sync(series_id, chapter_ids=[chapter["id"]])
                    refreshed = get_chapter(series_id, chapter["id"])
                    if refreshed:
                        chapter = refreshed
            except Exception as e:
                print(f"[Images] Auto-sync after create failed (non-fatal): {e}")
            return chapter
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_chapter_assets(self, series_id: str, chapter_id: str):
        """Return a chapter's stored images as {filename: data-URI} for inline rendering."""
        try:
            return get_chapter_assets_db(series_id, chapter_id)
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

    def update_chapter_summary(self, series_id: str, chapter_id: str, summary: str):
        """Update chapter rolling memory summary"""
        try:
            return update_chapter_summary(series_id, chapter_id, summary)
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

    def add_glossary_entry(self, series_id: str, source_term: str, translated_term: str, notes: str,
                           aliases=None):
        """Add a glossary entry (aliases: other source spellings, optional)"""
        try:
            return add_glossary_entry(series_id, source_term, translated_term, notes, aliases)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def add_glossary_alias(self, series_id: str, entry_id: str, alias: str):
        """Record another source spelling of a glossary entry"""
        try:
            return add_glossary_alias(series_id, entry_id, alias)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def remove_glossary_alias(self, series_id: str, entry_id: str, alias: str):
        """Remove one source spelling from a glossary entry"""
        try:
            return remove_glossary_alias(series_id, entry_id, alias)
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

    def start_agent_run(self, series_id: str, brief: str = "", review: str = "findings",
                        volume_pass: bool = True, rereview: bool = False, safe_fixes: bool = True):
        """Agent review over the translated chapters (safe fixes -> review -> volume pass)."""
        try:
            return self._worker_manager.start_agent_run(
                series_id,
                brief=brief or "",
                review=review or "findings",
                volume_pass=bool(volume_pass),
                rereview=bool(rereview),
                safe_fixes=bool(safe_fixes),
            )
        except Exception as e:
            return {"error": True, "message": str(e)}

    def list_agent_backups(self, series_id: str):
        """Whole-series snapshots taken before each agent run, newest first."""
        try:
            from core.agent_backup import list_backups
            return list_backups(series_id)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def restore_agent_backup(self, series_id: str, backup_id: str, restore_glossary: bool = False):
        """Put every chapter back as it was before that agent run (current versions archived first)."""
        try:
            if self._worker_manager.is_series_running(series_id):
                return {"error": True, "message": "Series ini sedang diproses — tunggu sampai selesai."}
            from core.agent_backup import restore_backup
            return restore_backup(series_id, backup_id, bool(restore_glossary))
        except Exception as e:
            return {"error": True, "message": str(e)}

    # ── QA (deterministic, no AI) ──────────────────────────────────────────

    def qa_scan_series(self, series_id: str, include_low: bool = True):
        """Volume-wide QA report: per-chapter findings + cross-chapter checks."""
        try:
            from core.qa_scan import scan_series
            return scan_series(series_id, include_low=bool(include_low))
        except Exception as e:
            return {"error": True, "message": str(e)}

    def qa_preview_fixes(self, series_id: str, categories):
        """Dry run of the safe-fix categories over every translated chapter."""
        try:
            from core.qa_scan import preview_safe_fixes
            cats = json.loads(categories) if isinstance(categories, str) else list(categories or [])
            return preview_safe_fixes(series_id, cats)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def qa_preview_rename(self, series_id: str, old: str, new: str):
        """Where a rendering occurs: translations, summaries, memory, glossary."""
        try:
            from core.qa_scan import preview_rename
            return preview_rename(series_id, old, new)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def qa_apply_rename(self, series_id: str, old: str, new: str):
        """Replace a rendering everywhere it could re-enter the context."""
        try:
            if self._worker_manager.is_series_running(series_id):
                return {"error": True, "message": "Series ini sedang diproses — tunggu sampai selesai."}
            from core.qa_scan import apply_rename
            return apply_rename(series_id, old, new)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def glossary_audit(self, series_id: str):
        """Per-entry usefulness: source frequency, usage, variants, conflicts (no AI)."""
        try:
            from core.glossary_audit import audit_glossary
            return audit_glossary(series_id)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def qa_chapter_detail(self, series_id: str, chapter_id: str):
        """One chapter for in-place review: paragraphs, findings, source map, fix previews."""
        try:
            from core.qa_chapter import chapter_detail
            return chapter_detail(series_id, chapter_id)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def qa_update_paragraph(self, series_id: str, chapter_id: str, index: int, expected: str,
                            new_text: str, archive: bool = True):
        """Replace (or with empty text, delete) one paragraph; returns the refreshed detail."""
        try:
            if self._worker_manager.is_series_running(series_id):
                return {"error": True, "message": "Series ini sedang diproses — tunggu sampai selesai."}
            from core.qa_chapter import update_paragraph
            return update_paragraph(series_id, chapter_id, int(index), expected or "", new_text or "", bool(archive))
        except Exception as e:
            return {"error": True, "message": str(e)}

    def qa_suggest_fix(self, series_id: str, chapter_id: str, index: int):
        """Ask the series' worker model for a corrected paragraph (one call)."""
        try:
            from core.qa_chapter import suggest_fix
            from core.llm_client import LLMClient
            series = get_series(series_id) or {}
            workers = self._get_config().get("workers", [])
            worker = next((w for w in workers if w.get("id") == series.get("workerId")), None) or (workers[0] if workers else None)
            if not worker:
                return {"error": True, "message": "Belum ada worker. Tambahkan worker di Settings."}
            client = LLMClient(self._worker_manager._build_worker_config(worker))
            return suggest_fix(client, series_id, chapter_id, int(index))
        except Exception as e:
            return {"error": True, "message": str(e)}

    def glossary_resolve(self, series_id: str, action):
        """Apply one decision from the glossary review flow (canonical / ignore / delete / merge)."""
        try:
            if self._worker_manager.is_series_running(series_id):
                return {"error": True, "message": "Series ini sedang diproses — tunggu sampai selesai."}
            from core.glossary_audit import resolve_entry
            act = json.loads(action) if isinstance(action, str) else dict(action or {})
            return resolve_entry(series_id, act)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def glossary_delete_entries(self, series_id: str, entry_ids):
        """Delete many entries at once; removed entries are backed up to a JSON file first."""
        try:
            from core.glossary_audit import delete_entries
            ids = json.loads(entry_ids) if isinstance(entry_ids, str) else list(entry_ids or [])
            return delete_entries(series_id, ids)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def qa_apply_fixes(self, series_id: str, categories, chapter_ids=None):
        """Apply safe fixes; each changed chapter is archived to version history first."""
        try:
            if self._worker_manager.is_series_running(series_id):
                return {"error": True, "message": "Series ini sedang diproses — tunggu sampai selesai."}
            from core.qa_scan import apply_safe_fixes_to_series
            cats = json.loads(categories) if isinstance(categories, str) else list(categories or [])
            ids = json.loads(chapter_ids) if isinstance(chapter_ids, str) else chapter_ids
            return apply_safe_fixes_to_series(series_id, cats, ids or None)
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

    def pick_image_folder(self, initial: str = ""):
        """Open a native folder picker for the series image source."""
        try:
            import webview
            result = self._window.create_file_dialog(
                webview.FOLDER_DIALOG,
                directory=initial or "",
            )
            if not result:
                return {"error": False, "cancelled": True, "path": ""}
            path = result[0] if isinstance(result, (list, tuple)) else result
            return {"error": False, "cancelled": False, "path": str(path)}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def describe_image_folder(self, folder: str):
        """Validate a folder path and report how many images it holds."""
        try:
            from core.image_sync import describe_folder
            return describe_folder(folder)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_series_image_status(self, series_id: str):
        """Counts for the managed pool and the assigned external folder."""
        try:
            from core.image_sync import list_folder_images, get_series_image_pool
            series = get_series(series_id)
            if not series:
                return {"error": True, "message": "Series tidak ditemukan"}
            folder = (series.get("imageFolder") or "").strip()
            return {
                "folder": folder,
                "folderCount": len(list_folder_images(folder)),
                "poolCount": len(list_folder_images(str(get_series_image_pool(series_id)))),
            }
        except Exception as e:
            return {"error": True, "message": str(e)}

    def upload_series_images(self, series_id: str, images=None):
        """Store drag & dropped images into the series' managed image pool."""
        try:
            from core.image_sync import save_uploaded_images
            saved = save_uploaded_images(series_id, images or [])
            return {"saved": saved}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def sync_series_images(self, series_id: str):
        """Match placeholder lines against the image sources and copy them in."""
        try:
            from core.image_sync import sync_series_images as _sync
            return _sync(series_id, log=print)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def clear_series_image_pool(self, series_id: str):
        """Empty the managed image pool (does not touch the external folder)."""
        try:
            import shutil
            from core.image_sync import get_series_image_pool
            pool = get_series_image_pool(series_id)
            if pool.exists():
                shutil.rmtree(pool)
            return {"cleared": True}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def run_terminology_prepass(self, series_id: str, worker_id: str = None):
        """Scan every chapter's raw source and propose glossary entries.

        Returns the proposals only — nothing is written to the glossary, so the
        user can review and edit before applying.
        """
        try:
            from core.terminology import run_terminology_prepass as _prepass

            series = get_series(series_id)
            if not series:
                return {"error": True, "message": "Series tidak ditemukan"}

            chapters = get_chapters(series_id)
            if not any((c.get("rawContent") or "").strip() for c in chapters):
                return {"error": True, "message": "Belum ada chapter dengan raw content"}

            config = self._get_config()
            workers = config.get("workers", [])
            target_worker = None
            if worker_id:
                target_worker = next((w for w in workers if w.get("id") == worker_id), None)
            if target_worker is None:
                target_worker = next((w for w in workers if w.get("id") == series.get("workerId")), None)
            if target_worker is None and workers:
                target_worker = workers[0]

            if target_worker:
                worker_config = {**config}
                worker_config["provider"] = target_worker.get("provider") or config.get("provider")
                worker_config["model"] = target_worker.get("model") or config.get("model")
                if target_worker.get("deepseekApiKeyId"):
                    worker_config["deepseekApiKeyId"] = target_worker["deepseekApiKeyId"]
                client = LLMClient(worker_config)
            else:
                client = self._get_llm_client()

            return _prepass(client, chapters, series, log=print)
        except Exception as e:
            return {"error": True, "message": str(e)}

    def fix_cjk_text(self, text: str, worker_id: str = None):
        """Fix CJK characters embedded in translated text using AI.
        Uses the specified worker (or first available worker / default config).
        """
        try:
            config = self._get_config()
            workers = config.get("workers", [])

            # Resolve which worker config to use
            target_worker = None
            if worker_id:
                target_worker = next((w for w in workers if w.get("id") == worker_id), None)
            if target_worker is None and workers:
                target_worker = workers[0]

            if target_worker:
                worker_config = {**config}
                worker_config["provider"] = target_worker.get("provider") or config.get("provider")
                worker_config["model"] = target_worker.get("model") or config.get("model")
                client = LLMClient(worker_config)
            else:
                client = self._get_llm_client()

            system_prompt = (
                "You are a translation error fixer. The text you receive is an excerpt from an "
                "English translation of a Japanese/Korean light novel. It contains one or more "
                "untranslated CJK characters embedded inline in English sentences.\n\n"
                "Your task: replace each CJK sequence with its correct English meaning, keeping "
                "everything else IDENTICAL — same punctuation, same formatting, same whitespace.\n\n"
                "Language identification:\n"
                "- Hiragana/Katakana present → Japanese reading and meaning\n"
                "- Kanji only (in LN context) → Japanese reading and meaning "
                "(e.g. 治安→public order, 成果→results, 平凡→ordinary, 優秀→excellent, 契約→contract)\n"
                "- Hangul → Korean meaning\n\n"
                "Output ONLY the corrected text. No explanation, no preamble, no markdown."
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Fix the CJK in this text:\n\n{text}"},
            ]

            response = client.complete(messages, stream=False, max_tokens=512)

            # Extract text from response (handles content str or list of parts)
            fixed = ""
            if hasattr(response, "choices") and response.choices:
                choice = response.choices[0]
                if hasattr(choice, "message"):
                    content = getattr(choice.message, "content", "")
                    if isinstance(content, str):
                        fixed = content.strip()
                    elif isinstance(content, list):
                        parts = []
                        for item in content:
                            if isinstance(item, str):
                                parts.append(item)
                            elif isinstance(item, dict):
                                parts.append(str(item.get("text") or item.get("content") or ""))
                        fixed = "".join(parts).strip()

            if not fixed:
                return {"error": True, "message": "Model returned empty response"}
            return {"fixed": fixed}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def parse_document(self, filename: str, data_base64: str, mode: str = 'standard', top_margin: float = 0, bottom_margin: float = 0):
        """Parse a .docx or .pdf file and return markdown content.
        mode: 'standard' (default) or 'flow' (paragraph reconstruction for line-break PDFs).
        top_margin/bottom_margin: hard-cut zones in pt (0 = auto 8%).
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
                    return parse_pdf_flow(data, filename, top_margin=top_margin, bottom_margin=bottom_margin)
                return parse_pdf(data, filename, top_margin=top_margin, bottom_margin=bottom_margin)
            else:
                return {"error": True, "message": f"Format tidak didukung: {ext}"}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def render_pdf_pages(self, data_base64: str, page_indices: list = None) -> dict:
        """Render PDF pages as base64-encoded PNG images."""
        try:
            import base64 as b64mod
            from core.document_parser import render_pdf_page
            data = b64mod.b64decode(data_base64)
            indices = page_indices if page_indices is not None else [0, 1, 2]
            images = []
            for idx in indices:
                try:
                    png = render_pdf_page(data, idx)
                    images.append(b64mod.b64encode(png).decode())
                except Exception:
                    break
            return {"images": images}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def detect_pdf_margins(self, data_base64: str) -> dict:
        """Detect header/footer cut zones in a PDF."""
        try:
            import base64 as b64mod
            from core.document_parser import detect_pdf_cut_zones
            data = b64mod.b64decode(data_base64)
            return detect_pdf_cut_zones(data)
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
