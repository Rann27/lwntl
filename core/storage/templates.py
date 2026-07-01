"""
Profile Templates Storage
Stores per-profile system prompt and instructions templates.
"""

import json
from pathlib import Path
from typing import Dict, Any

from .config import get_profile_data_dir


def _get_templates_path(profile_name: str = None) -> Path:
    return get_profile_data_dir(profile_name) / 'templates.json'


def get_profile_templates(profile_name: str = None) -> Dict[str, str]:
    path = _get_templates_path(profile_name)
    if not path.exists():
        return {"systemPromptTemplate": "", "instructionsTemplate": ""}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {
            "systemPromptTemplate": data.get("systemPromptTemplate", ""),
            "instructionsTemplate": data.get("instructionsTemplate", ""),
        }
    except (OSError, json.JSONDecodeError):
        return {"systemPromptTemplate": "", "instructionsTemplate": ""}


def save_profile_templates(
    system_prompt_template: str,
    instructions_template: str,
    profile_name: str = None,
) -> bool:
    path = _get_templates_path(profile_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(
            {
                "systemPromptTemplate": system_prompt_template,
                "instructionsTemplate": instructions_template,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    return True
