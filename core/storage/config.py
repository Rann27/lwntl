"""
Config Management
Handles config.json (global) and per-profile data directories.
"""

import json
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import Dict, Any, List

DEFAULT_PROFILE = "Default"
_VALID_PROFILE_RE = re.compile(r'^[\w\- ]{1,64}$')


def get_app_data_dir() -> Path:
    """Root lwntl data dir — stores global config.json and profiles/."""
    if os.name == 'nt':
        app_data = os.environ.get('APPDATA', os.path.expanduser('~'))
        return Path(app_data) / 'lwntl'
    elif os.name == 'posix':
        if os.uname().sysname.lower() == 'darwin':
            return Path.home() / 'Library' / 'Application Support' / 'lwntl'
        else:
            return Path.home() / '.config' / 'lwntl'
    return Path.home() / '.lwntl'


def get_config_path() -> Path:
    return get_app_data_dir() / 'config.json'


# ── Profile management ──────────────────────────────────────────────────────

def _profiles_meta_path() -> Path:
    return get_app_data_dir() / 'profiles.json'


def _profiles_root() -> Path:
    return get_app_data_dir() / 'profiles'


def _migrate_legacy_data():
    """
    One-time migration: move root-level series/ + groups.json into
    profiles/Default/ so existing data survives the profile refactor.
    """
    root = get_app_data_dir()
    profiles_root = _profiles_root()
    meta_path = _profiles_meta_path()

    if meta_path.exists():
        return  # Already migrated

    default_dir = profiles_root / DEFAULT_PROFILE
    default_dir.mkdir(parents=True, exist_ok=True)

    legacy_series = root / 'series'
    if legacy_series.exists() and legacy_series.is_dir():
        shutil.move(str(legacy_series), str(default_dir / 'series'))

    legacy_groups = root / 'groups.json'
    if legacy_groups.exists():
        shutil.move(str(legacy_groups), str(default_dir / 'groups.json'))

    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump({"active": DEFAULT_PROFILE}, f)


def get_active_profile_name() -> str:
    _migrate_legacy_data()
    meta_path = _profiles_meta_path()
    try:
        with open(meta_path, 'r', encoding='utf-8') as f:
            return json.load(f).get("active", DEFAULT_PROFILE)
    except (OSError, json.JSONDecodeError):
        return DEFAULT_PROFILE


def get_profile_data_dir(profile_name: str = None) -> Path:
    """Return the data dir for the given profile (defaults to active)."""
    name = profile_name or get_active_profile_name()
    path = _profiles_root() / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_all_profiles() -> List[str]:
    _migrate_legacy_data()
    root = _profiles_root()
    root.mkdir(parents=True, exist_ok=True)
    names = sorted(p.name for p in root.iterdir() if p.is_dir())
    if not names:
        names = [DEFAULT_PROFILE]
    return names


def create_profile(name: str) -> Dict[str, Any]:
    name = name.strip()
    if not _VALID_PROFILE_RE.match(name):
        raise ValueError(f"Invalid profile name: '{name}'")
    path = _profiles_root() / name
    if path.exists():
        raise ValueError(f"Profile '{name}' already exists")
    path.mkdir(parents=True, exist_ok=True)
    return {"name": name}


def delete_profile(name: str) -> bool:
    active = get_active_profile_name()
    if name == active:
        raise ValueError("Cannot delete the active profile")
    path = _profiles_root() / name
    if not path.exists():
        raise ValueError(f"Profile '{name}' not found")
    shutil.rmtree(path)
    return True


def rename_profile(old_name: str, new_name: str) -> Dict[str, Any]:
    new_name = new_name.strip()
    if not _VALID_PROFILE_RE.match(new_name):
        raise ValueError(f"Invalid profile name: '{new_name}'")
    old_path = _profiles_root() / old_name
    new_path = _profiles_root() / new_name
    if not old_path.exists():
        raise ValueError(f"Profile '{old_name}' not found")
    if new_path.exists():
        raise ValueError(f"Profile '{new_name}' already exists")
    old_path.rename(new_path)
    # If this was the active profile, update the pointer
    if get_active_profile_name() == old_name:
        _set_active(new_name)
    return {"name": new_name}


def switch_profile(name: str) -> bool:
    if not (_profiles_root() / name).exists():
        raise ValueError(f"Profile '{name}' not found")
    _set_active(name)
    return True


def _set_active(name: str):
    meta_path = _profiles_meta_path()
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump({"active": name}, f)


DEFAULT_CONFIG = {
    "provider": "zhipuai",
    "model": "glm-5",
    "workers": [
        {
            "id": "default",
            "label": "worker 1",
            "provider": "zhipuai",
            "model": "glm-5",
            "maxConcurrent": 1,
        }
    ],
    "customModels": {},
    "zhipuaiApiKey": "",
    "zhipuaiThinking": True,
    "qwenApiKey": "",
    "openaiApiKey": "",
    "geminiApiKey": "",
    "anthropicApiKey": "",
    "xaiApiKey": "",
    "moonshotApiKey": "",
    "deepseekApiKey": "",
    "deepseekThinking": False,
    "deepseekReasoningEffort": "high",
    "mimoApiKey": "",
    "mimoThinking": True,
    "mimoReasoningEffort": "medium",
    "openaicompatApiKey": "",
    "openaicompatBaseUrl": "",
    "openaicompatUserAgent": "lwntl/1.0 (+openai-compatible)",
    "openaicompatClientName": "lwntl",
    "openaicompatExtraHeaders": {},
    "temperature": 0.3,
    "maxTokensPerIteration": 16000,
    "glossaryPreFilter": True,
    "theme": "light",
    "uiLanguage": "id",
    "sourceLanguages": ["Japanese", "Chinese", "Korean"],
    "targetLanguages": ["Indonesian", "English"],
}


def _normalize_workers(config: Dict[str, Any]) -> Dict[str, Any]:
    """Backfill and sanitize worker profiles for old config files."""
    workers = config.get("workers")
    if not isinstance(workers, list) or not workers:
        workers = [
            {
                "id": "default",
                "label": "worker 1",
                "provider": config.get("provider", DEFAULT_CONFIG["provider"]),
                "model": config.get("model", DEFAULT_CONFIG["model"]),
            }
        ]

    normalized = []
    seen_ids = set()
    for i, worker in enumerate(workers, start=1):
        if not isinstance(worker, dict):
            continue
        worker_id = str(worker.get("id") or "").strip() or str(uuid.uuid4())
        if worker_id in seen_ids:
            worker_id = str(uuid.uuid4())
        seen_ids.add(worker_id)
        normalized.append({
            "id": worker_id,
            "label": str(worker.get("label") or f"worker {i}").strip() or f"worker {i}",
            "provider": str(worker.get("provider") or config.get("provider", DEFAULT_CONFIG["provider"])),
            "model": str(worker.get("model") or config.get("model", DEFAULT_CONFIG["model"])),
            "maxConcurrent": max(1, int(worker.get("maxConcurrent") or 1)),
        })

    if not normalized:
        normalized = DEFAULT_CONFIG["workers"].copy()

    config["workers"] = normalized
    return config


def get_config() -> Dict[str, Any]:
    """
    Read config.json, merged with DEFAULT_CONFIG so new fields added in later
    versions always have a value even on old installs.

    Raises:
        FileNotFoundError: If config file doesn't exist
        json.JSONDecodeError: If config file is invalid JSON
    """
    config_path = get_config_path()

    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found at {config_path}")

    with open(config_path, 'r', encoding='utf-8') as f:
        stored = json.load(f)

    return _normalize_workers({**DEFAULT_CONFIG, **stored})


def save_config(config: Dict[str, Any]) -> bool:
    """
    Save config to config.json
    
    Args:
        config: Configuration dictionary to save
        
    Returns:
        bool: True if successful
        
    Raises:
        OSError: If unable to write file
    """
    config_path = get_config_path()
    
    # Create directory if it doesn't exist
    config_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(_normalize_workers(config), f, indent=2, ensure_ascii=False)
    
    return True


def init_config() -> Dict[str, Any]:
    """
    Initialize config.json with default values if it doesn't exist
    
    Returns:
        dict: The configuration (existing or newly created)
    """
    config_path = get_config_path()
    
    if not config_path.exists():
        # Create directory if needed
        config_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write default config
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_CONFIG, f, indent=2, ensure_ascii=False)
        
        return _normalize_workers(DEFAULT_CONFIG.copy())
    
    # Config exists, read it
    return get_config()


def update_config(updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update specific fields in config
    
    Args:
        updates: Dictionary of fields to update
        
    Returns:
        dict: Updated configuration
    """
    config = get_config()
    config.update(updates)
    save_config(config)
    return config
