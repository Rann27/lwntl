"""
Groups Management
Handles groups.json CRUD for hierarchical series organization (max 3 levels).
"""

import json
import uuid
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from .config import get_app_data_dir

MAX_DEPTH = 2  # 0-indexed depth: level 0, 1, 2 → 3 visible levels total


def get_groups_path() -> Path:
    return get_app_data_dir() / 'groups.json'


def _load() -> List[Dict[str, Any]]:
    path = get_groups_path()
    if not path.exists():
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _save(groups: List[Dict[str, Any]]) -> None:
    path = get_groups_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(groups, f, indent=2, ensure_ascii=False)


def _depth(group_id: str, groups: List[Dict[str, Any]]) -> int:
    """Returns depth of a group (root-level = 0). Guards against cycles."""
    visited: set = set()
    d = 0
    cur = group_id
    while True:
        g = next((g for g in groups if g['id'] == cur), None)
        if not g or not g.get('parentId'):
            return d
        if cur in visited:
            return d
        visited.add(cur)
        cur = g['parentId']
        d += 1


def get_all_groups() -> List[Dict[str, Any]]:
    return _load()


def create_group(name: str, parent_id: Optional[str] = None, color: str = '') -> Dict[str, Any]:
    groups = _load()
    if parent_id:
        if not any(g['id'] == parent_id for g in groups):
            raise FileNotFoundError(f"Parent group {parent_id} not found")
        if _depth(parent_id, groups) >= MAX_DEPTH:
            raise ValueError(f"Maximum nesting depth ({MAX_DEPTH + 1} levels) already reached")
    now = datetime.utcnow().isoformat() + 'Z'
    group: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "name": name.strip() or "Grup Baru",
        "parentId": parent_id,
        "color": color or '#00F7FF',
        "createdAt": now,
        "updatedAt": now,
    }
    groups.append(group)
    _save(groups)
    return group


def update_group(group_id: str, name: Optional[str] = None, color: Optional[str] = None) -> Dict[str, Any]:
    groups = _load()
    group = next((g for g in groups if g['id'] == group_id), None)
    if not group:
        raise FileNotFoundError(f"Group {group_id} not found")
    if name is not None:
        group['name'] = name.strip() or group['name']
    if color is not None:
        group['color'] = color
    group['updatedAt'] = datetime.utcnow().isoformat() + 'Z'
    _save(groups)
    return group


def delete_group(group_id: str) -> Optional[str]:
    """
    Delete a group. Returns the parent_id (may be None) so the caller
    can re-parent series that belonged to this group.
    Child groups are automatically re-parented to the deleted group's parent.
    """
    groups = _load()
    target = next((g for g in groups if g['id'] == group_id), None)
    if not target:
        return None
    parent_id: Optional[str] = target.get('parentId')
    for g in groups:
        if g.get('parentId') == group_id:
            g['parentId'] = parent_id
    groups = [g for g in groups if g['id'] != group_id]
    _save(groups)
    return parent_id
