"""
Profile Templates Storage
Stores per-profile system prompt and instructions templates, plus the editable
guidance for the helper passes (revision, AutoFix CJK, terminology pre-pass).
systemPromptPreset points at a prompt preset (core/prompt_presets) used when the
system prompt text is empty.
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional

from .config import get_profile_data_dir

_FIELDS = (
    "systemPromptTemplate",
    "instructionsTemplate",
    "revisionPromptTemplate",
    "autofixPromptTemplate",
    "prepassPromptTemplate",
    "systemPromptPreset",
)


def _get_templates_path(profile_name: str = None) -> Path:
    return get_profile_data_dir(profile_name) / 'templates.json'


def get_profile_templates(profile_name: str = None) -> Dict[str, str]:
    empty = {k: "" for k in _FIELDS}
    path = _get_templates_path(profile_name)
    if not path.exists():
        return empty
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {k: data.get(k, "") or "" for k in _FIELDS}
    except (OSError, json.JSONDecodeError):
        return empty


def save_profile_templates(
    system_prompt_template: str,
    instructions_template: str,
    profile_name: str = None,
    revision_prompt_template: Optional[str] = None,
    autofix_prompt_template: Optional[str] = None,
    prepass_prompt_template: Optional[str] = None,
    system_prompt_preset: Optional[str] = None,
) -> bool:
    path = _get_templates_path(profile_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Preserve a template the caller did not pass, so an older save path cannot
    # wipe one it does not know about.
    current = get_profile_templates(profile_name)
    data: Dict[str, Any] = {
        "systemPromptTemplate": system_prompt_template,
        "instructionsTemplate": instructions_template,
        "revisionPromptTemplate": current["revisionPromptTemplate"] if revision_prompt_template is None else revision_prompt_template,
        "autofixPromptTemplate": current["autofixPromptTemplate"] if autofix_prompt_template is None else autofix_prompt_template,
        "prepassPromptTemplate": current["prepassPromptTemplate"] if prepass_prompt_template is None else prepass_prompt_template,
        "systemPromptPreset": current["systemPromptPreset"] if system_prompt_preset is None else system_prompt_preset,
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return True
