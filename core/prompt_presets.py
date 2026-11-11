"""
Prompt Presets — built-in system prompts per language pair, plus the user's own.

Built-ins ship with LWNTL in core/presets (generated from the Cowork prompt
package by tools/build_presets.py) and are read-only: they are replaced on every
update, so an edit there would be lost. To change one, duplicate it — the copy
is a user preset, stored in the app data folder (shared by every profile) and
fully editable.

A series or a profile points at a preset by id ("builtin:JP-ID", "user:<uuid>")
instead of copying its text, so an improved built-in reaches everything that
uses it, and editing a user preset updates every series that picked it.

When nothing is configured at all — no system prompt or instructions on the
series or the profile — the built-in for the series' language pair is used, so a
new series translates with real rules instead of none.
"""

import json
import sys
import uuid
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from .storage.config import get_app_data_dir

BUILTIN = "builtin:"
USER = "user:"

_LANG_CODES = (
    ("japan", "JP"), ("chin", "CN"), ("mandarin", "CN"), ("korea", "KR"),
    ("engl", "EN"), ("indones", "ID"),
)


def lang_code(language: str) -> str:
    """'Japanese' → 'JP', 'Indonesian' → 'ID'; '' for anything without a preset."""
    lang = (language or "").strip().lower()
    return next((code for prefix, code in _LANG_CODES if lang.startswith(prefix)), "")


def _builtin_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "core" / "presets"
    return Path(__file__).resolve().parent / "presets"


@lru_cache(maxsize=1)
def _builtin_index() -> List[Dict[str, Any]]:
    path = _builtin_dir() / "index.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []


@lru_cache(maxsize=16)
def _builtin_text(file: str) -> str:
    try:
        return (_builtin_dir() / file).read_text(encoding="utf-8")
    except OSError:
        return ""


def _user_path() -> Path:
    return get_app_data_dir() / "prompt_presets.json"


def _load_user() -> List[Dict[str, Any]]:
    path = _user_path()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return [p for p in data if isinstance(p, dict) and str(p.get("id", "")).startswith(USER)]
    except (OSError, json.JSONDecodeError):
        return []


def _save_user(presets: List[Dict[str, Any]]):
    path = _user_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(presets, ensure_ascii=False, indent=2), encoding="utf-8")


def _builtin_entry(meta: Dict[str, Any], with_text: bool) -> Dict[str, Any]:
    entry = {
        "id": meta["id"], "name": meta["name"], "title": meta.get("title", ""),
        "sourceLanguage": meta.get("sourceLanguage", ""), "targetLanguage": meta.get("targetLanguage", ""),
        "builtin": True, "basedOn": "",
    }
    if with_text:
        entry["text"] = _builtin_text(meta["file"])
    return entry


def _user_entry(p: Dict[str, Any], with_text: bool) -> Dict[str, Any]:
    entry = {k: p.get(k, "") for k in ("id", "name", "sourceLanguage", "targetLanguage", "basedOn", "updatedAt")}
    entry["builtin"] = False
    if with_text:
        entry["text"] = p.get("text", "")
    return entry


def list_presets(with_text: bool = False) -> List[Dict[str, Any]]:
    """Built-ins first (by pair), then the user's presets (by name)."""
    out = [_builtin_entry(m, with_text) for m in _builtin_index()]
    out += [_user_entry(p, with_text) for p in sorted(_load_user(), key=lambda p: p.get("name", "").lower())]
    return out


def get_preset(preset_id: str) -> Optional[Dict[str, Any]]:
    pid = preset_id or ""
    if pid.startswith(BUILTIN):
        meta = next((m for m in _builtin_index() if m["id"] == pid), None)
        return _builtin_entry(meta, True) if meta else None
    if pid.startswith(USER):
        p = next((p for p in _load_user() if p["id"] == pid), None)
        return _user_entry(p, True) if p else None
    return None


def preset_text(preset_id: str) -> str:
    """The preset's prompt, or '' when the id is empty or no longer exists."""
    p = get_preset(preset_id)
    return (p or {}).get("text", "") or ""


def match_builtin(source_language: str, target_language: str) -> str:
    """Id of the built-in for this language pair, or ''."""
    pair = f"{lang_code(source_language)}-{lang_code(target_language)}"
    return next((m["id"] for m in _builtin_index() if m.get("pair") == pair), "")


def duplicate_preset(preset_id: str, name: str = "") -> Dict[str, Any]:
    """Copy any preset into a new, editable user preset."""
    src = get_preset(preset_id)
    if src is None:
        raise ValueError("Preset tidak ditemukan")
    now = datetime.utcnow().isoformat() + "Z"
    copy = {
        "id": USER + str(uuid.uuid4()),
        "name": (name or "").strip() or f"{src['name']} (salinan)",
        "text": src.get("text", ""),
        "sourceLanguage": src.get("sourceLanguage", ""),
        "targetLanguage": src.get("targetLanguage", ""),
        "basedOn": src["id"] if src.get("builtin") else src.get("basedOn", ""),
        "createdAt": now,
        "updatedAt": now,
    }
    presets = _load_user()
    presets.append(copy)
    _save_user(presets)
    return _user_entry(copy, True)


def save_user_preset(preset_id: str, name: str, text: str) -> Dict[str, Any]:
    """Rename / rewrite a user preset. Built-ins cannot be edited — duplicate them."""
    if not (preset_id or "").startswith(USER):
        raise ValueError("Preset bawaan tidak bisa diedit — duplikat dulu untuk mengubahnya")
    presets = _load_user()
    p = next((p for p in presets if p["id"] == preset_id), None)
    if p is None:
        raise ValueError("Preset tidak ditemukan")
    if not (name or "").strip():
        raise ValueError("Nama preset kosong")
    p["name"] = name.strip()
    p["text"] = text or ""
    p["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    _save_user(presets)
    return _user_entry(p, True)


def delete_user_preset(preset_id: str) -> bool:
    """
    Remove a user preset. Series or profiles that pointed at it fall back to the
    next level (profile template, then the built-in for their pair).
    """
    if not (preset_id or "").startswith(USER):
        raise ValueError("Preset bawaan tidak bisa dihapus")
    presets = _load_user()
    kept = [p for p in presets if p["id"] != preset_id]
    if len(kept) == len(presets):
        return False
    _save_user(kept)
    return True


def preset_name(preset_id: str) -> str:
    p = get_preset(preset_id)
    return p["name"] if p else ""
