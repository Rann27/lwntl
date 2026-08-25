"""
Image Folder Sync

Resolves `Image Placeholder: <filename>` lines against a folder of images and
copies the matches into each chapter's assets/, so they render in the editor and
embed on export.

DOCX and PDF imports carry their images along, but TXT/MD/manual chapters only
carry the placeholder line — the filename is there, the bytes are not. Pointing a
series at the folder those images live in closes that gap, and because the whole
thing keys off placeholder lines it works the same for every input type,
including older DOCX/PDF chapters imported before image support existed.

Two sources are consulted per series, in order:
  1. the managed pool at series/<id>/images/ (populated by drag & drop)
  2. the external folder assigned on the series (imageFolder)

Matching is by exact, case-sensitive filename. The only tolerance is the
extension, so a placeholder saying `cover.jpg` still finds `cover.png` — but
`Cover.jpg` will not match `cover.jpg`.
"""

import base64
import shutil
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .placeholder import collect_placeholder_filenames
from .storage.chapters import (
    get_chapters, get_chapter, get_chapter_assets_dir, get_chapter_path,
)
from .storage.series import get_series, get_series_dir

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff'}

_MIME_BY_EXT = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
    '.tif': 'image/tiff', '.tiff': 'image/tiff',
}


def _mime_for(path: Path) -> str:
    return _MIME_BY_EXT.get(path.suffix.lower(), 'image/jpeg')


def get_series_image_pool(series_id: str) -> Path:
    """Managed image folder for a series (filled by drag & drop uploads)."""
    return get_series_dir() / series_id / 'images'


def list_folder_images(folder: str) -> List[Path]:
    """Image files directly inside `folder` (non-recursive). Empty if unusable."""
    if not folder:
        return []
    try:
        p = Path(folder)
        if not p.is_dir():
            return []
        return sorted(
            f for f in p.iterdir()
            if f.is_file() and f.suffix.lower() in IMAGE_EXTS
        )
    except Exception:
        return []


def describe_folder(folder: str) -> Dict[str, Any]:
    """Quick validity/preview info for a candidate folder, for the UI."""
    if not folder or not folder.strip():
        return {"exists": False, "count": 0, "samples": []}
    p = Path(folder)
    if not p.is_dir():
        return {"exists": False, "count": 0, "samples": []}
    files = list_folder_images(folder)
    return {
        "exists": True,
        "count": len(files),
        "samples": [f.name for f in files[:8]],
    }


# Which format to keep when several files share a stem (e.g. cover.png + cover.jpg).
# Lossless and most common first; anything unlisted sorts last, ties break by name.
_EXT_PRIORITY = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff']


def _ext_rank(path: Path) -> tuple:
    ext = path.suffix.lower()
    idx = _EXT_PRIORITY.index(ext) if ext in _EXT_PRIORITY else len(_EXT_PRIORITY)
    return (idx, path.name)


def _build_index(series_id: str, external_folder: str) -> tuple:
    """Build (by_name, by_stem) lookup maps — both exact and case-sensitive.

    by_name handles the normal case. by_stem is the single tolerance: a
    placeholder may name a different extension than the file on disk.

    When several files share a stem only one can answer, so the format is picked
    by _EXT_PRIORITY. The managed pool overrides the external folder entirely.
    """
    by_name: Dict[str, Path] = {}
    by_stem: Dict[str, Path] = {}

    sources = [
        list_folder_images(external_folder),
        list_folder_images(str(get_series_image_pool(series_id))),
    ]
    for files in sources:  # later source wins outright
        stem_best: Dict[str, Path] = {}
        for f in files:
            by_name[f.name] = f
            prev = stem_best.get(f.stem)
            if prev is None or _ext_rank(f) < _ext_rank(prev):
                stem_best[f.stem] = f
        by_stem.update(stem_best)

    return by_name, by_stem


def _resolve(by_name: Dict[str, Path], by_stem: Dict[str, Path], filename: str) -> Optional[Path]:
    """Exact filename first; otherwise the same stem with another extension."""
    name = Path(filename).name.strip()
    if not name:
        return None
    hit = by_name.get(name)
    if hit is not None:
        return hit
    return by_stem.get(Path(name).stem)


def _write_chapter_manifest(series_id: str, chapter_id: str, manifest: List[Dict[str, str]]) -> None:
    import json
    path = get_chapter_path(series_id, chapter_id)
    with open(path, 'r', encoding='utf-8') as f:
        chapter = json.load(f)
    chapter['images'] = manifest
    from datetime import datetime
    chapter['updatedAt'] = datetime.utcnow().isoformat() + 'Z'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(chapter, f, indent=2, ensure_ascii=False)


def save_uploaded_images(series_id: str, images: List[Dict[str, Any]]) -> int:
    """Store drag & dropped images into the series' managed pool.

    Args:
        images: [{filename, data(base64)}]

    Returns:
        Number of files written.
    """
    if not images:
        return 0
    pool = get_series_image_pool(series_id)
    pool.mkdir(parents=True, exist_ok=True)

    saved = 0
    for img in images:
        name = Path(str(img.get('filename') or '')).name.strip()
        data = img.get('data') or ''
        if not name or not data:
            continue
        try:
            blob = base64.b64decode(data)
        except Exception:
            continue
        try:
            with open(pool / name, 'wb') as f:
                f.write(blob)
            saved += 1
        except Exception:
            continue
    return saved


def sync_series_images(
    series_id: str,
    chapter_ids: Optional[List[str]] = None,
    log: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """
    Copy every image referenced by a placeholder into the chapter that references it.

    Existing chapter assets are kept; a placeholder whose image is already present
    is left alone, so re-running is cheap and non-destructive.

    Args:
        chapter_ids: limit the pass to these chapters (used right after a chapter is
            created, so a bulk import does not rescan the whole series each time).

    Returns:
        {matched, missing, chaptersUpdated, missingNames[], poolCount, folderCount}
    """
    def _emit(msg: str):
        if callable(log):
            log(msg)

    series = get_series(series_id)
    if not series:
        raise FileNotFoundError(f"Series {series_id} not found")

    external = (series.get('imageFolder') or '').strip()
    by_name, by_stem = _build_index(series_id, external)

    pool_count = len(list_folder_images(str(get_series_image_pool(series_id))))
    folder_count = len(list_folder_images(external))

    if not by_name:
        _emit("[Images] No image source configured or folder is empty")
        return {
            "matched": 0, "missing": 0, "chaptersUpdated": 0, "missingNames": [],
            "poolCount": pool_count, "folderCount": folder_count,
        }

    matched = 0
    missing_names: List[str] = []
    chapters_updated = 0

    wanted = set(chapter_ids) if chapter_ids else None

    for chapter in get_chapters(series_id):
        chapter_id = chapter.get('id')
        if not chapter_id:
            continue
        if wanted is not None and chapter_id not in wanted:
            continue

        # Placeholders can live in the source and (after translation) the output.
        referenced = collect_placeholder_filenames(
            (chapter.get('rawContent') or '') + '\n' + (chapter.get('translatedContent') or '')
        )
        if not referenced:
            continue

        fresh = get_chapter(series_id, chapter_id) or {}
        manifest: List[Dict[str, str]] = list(fresh.get('images') or [])
        have = {str(e.get('filename') or '') for e in manifest}
        assets_dir = get_chapter_assets_dir(series_id, chapter_id)
        added_here = 0

        for name in referenced:
            target_name = Path(name).name
            if target_name in have and (assets_dir / target_name).exists():
                continue

            src = _resolve(by_name, by_stem, target_name)
            if src is None:
                if target_name not in missing_names:
                    missing_names.append(target_name)
                continue
            if src.name != target_name:
                _emit(f"[Images] '{target_name}' matched '{src.name}' (same name, different format)")

            try:
                assets_dir.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, assets_dir / target_name)
            except Exception as e:
                _emit(f"[Images] Failed to copy {src.name}: {e}")
                continue

            manifest = [m for m in manifest if str(m.get('filename') or '') != target_name]
            manifest.append({
                # Keep the placeholder's own spelling so the renderer and exporter,
                # which look the name up from the text, still find it.
                'filename': target_name,
                'mime': _mime_for(src),
                'file': f'assets/{target_name}',
            })
            have.add(target_name)
            matched += 1
            added_here += 1

        if added_here:
            _write_chapter_manifest(series_id, chapter_id, manifest)
            chapters_updated += 1
            _emit(f"[Images] Chapter {chapter.get('chapterNumber', '?')}: +{added_here} image(s)")

    _emit(
        f"[Images] {matched} image(s) linked across {chapters_updated} chapter(s)"
        + (f"; {len(missing_names)} placeholder(s) unmatched" if missing_names else "")
    )

    return {
        "matched": matched,
        "missing": len(missing_names),
        "chaptersUpdated": chapters_updated,
        "missingNames": missing_names[:50],
        "poolCount": pool_count,
        "folderCount": folder_count,
    }
