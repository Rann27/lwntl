"""
Agent Backups — a whole-series snapshot taken before every agent run.

Every agent edit is already archived in the chapter's version history, but
undoing a run that way means restoring chapter by chapter, and knowing which
version was the one before the run. The snapshot holds every translated chapter
as it was before the run, plus the glossary, so a run that made things worse is
undone in one step.

Stored as <series>/agent-backups/<stamp>.json; the newest MAX_BACKUPS are kept.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from .storage.chapters import (
    archive_current_translation, get_chapter, get_chapters, update_chapter_fields, update_chapter_translation,
)
from .storage.series import get_series, get_series_path

MAX_BACKUPS = 10


def _dir(series_id: str) -> Path:
    return get_series_path(series_id).parent / "agent-backups"


def create_backup(series_id: str, label: str = "agent run") -> Dict[str, Any]:
    """Snapshot every translated chapter and the glossary. Raises if it cannot be written."""
    series = get_series(series_id)
    if series is None:
        raise FileNotFoundError(f"Series {series_id} not found")
    chapters = [
        {"id": c["id"], "chapterNumber": c.get("chapterNumber"), "title": c.get("title", ""),
         "translatedContent": c.get("translatedContent") or "", "agentReview": c.get("agentReview")}
        for c in get_chapters(series_id) if (c.get("translatedContent") or "").strip()
    ]
    now = datetime.utcnow()
    backup_id = now.strftime("%Y%m%d-%H%M%S")
    data = {"id": backup_id, "createdAt": now.isoformat() + "Z", "label": label,
            "chapters": chapters, "glossary": series.get("glossary") or []}
    folder = _dir(series_id)
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{backup_id}.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    for old in sorted(folder.glob("*.json"))[:-MAX_BACKUPS]:
        old.unlink(missing_ok=True)
    return {"id": backup_id, "createdAt": data["createdAt"], "chapters": len(chapters)}


def list_backups(series_id: str) -> List[Dict[str, Any]]:
    """Newest first: {id, createdAt, label, chapters, glossary}."""
    out = []
    folder = _dir(series_id)
    for path in sorted(folder.glob("*.json"), reverse=True) if folder.exists() else []:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        out.append({"id": data.get("id", path.stem), "createdAt": data.get("createdAt", ""),
                    "label": data.get("label", ""), "chapters": len(data.get("chapters") or []),
                    "glossary": len(data.get("glossary") or [])})
    return out


def restore_backup(series_id: str, backup_id: str, restore_glossary: bool = False) -> Dict[str, Any]:
    """
    Put every chapter back as it was in the snapshot. The current translations are
    archived first, so the restore itself can be undone from version history.
    The agent-review mark goes back too, so a later run reviews those chapters again.

    The glossary is restored only on request: edits made to it after the run
    would otherwise be lost.
    """
    from .context_window import invalidate_context_cache

    path = _dir(series_id) / f"{backup_id}.json"
    if not path.exists():
        raise FileNotFoundError("Backup tidak ditemukan")
    data = json.loads(path.read_text(encoding="utf-8"))

    restored = 0
    for c in data.get("chapters") or []:
        current = get_chapter(series_id, c["id"])
        if current is None:
            continue
        if (current.get("translatedContent") or "") != c.get("translatedContent", ""):
            archive_current_translation(series_id, c["id"])
            update_chapter_translation(series_id, c["id"], c.get("translatedContent", ""))
            restored += 1
        update_chapter_fields(series_id, c["id"], agentReview=c.get("agentReview"))

    if restore_glossary:
        series = get_series(series_id)
        series["glossary"] = data.get("glossary") or []
        series["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        with open(get_series_path(series_id), "w", encoding="utf-8") as f:
            json.dump(series, f, indent=2, ensure_ascii=False)

    invalidate_context_cache(series_id)
    return {"chapters": restored, "glossary": bool(restore_glossary)}
