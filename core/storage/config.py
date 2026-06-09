"""
Config Management
Handles config.json in the application data directory
"""

import json
import os
import uuid
from pathlib import Path
from typing import Dict, Any


def get_app_data_dir() -> Path:
    """Get the application data directory based on OS"""
    if os.name == 'nt':  # Windows
        app_data = os.environ.get('APPDATA', os.path.expanduser('~'))
        return Path(app_data) / 'lwntl'
    elif os.name == 'posix':
        if os.uname().sysname.lower() == 'darwin':  # macOS
            return Path.home() / 'Library' / 'Application Support' / 'lwntl'
        else:  # Linux
            return Path.home() / '.config' / 'lwntl'
    else:
        # Fallback
        return Path.home() / '.lwntl'


def get_config_path() -> Path:
    """Get the path to config.json"""
    return get_app_data_dir() / 'config.json'


DEFAULT_CONFIG = {
    "provider": "zhipuai",
    "model": "glm-5",
    "workers": [
        {
            "id": "default",
            "label": "worker 1",
            "provider": "zhipuai",
            "model": "glm-5",
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
