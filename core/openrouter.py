"""
OpenRouter — one key, hundreds of models, each with its own parameter rules.

OpenRouter forwards a single OpenAI-style request to whichever upstream serves the
model, and silently drops parameters the model does not support. That is
convenient and dangerous at once: a setting can look applied while doing nothing.
So LWNTL decides per model what to send, from the model's own metadata in the
public catalog (https://openrouter.ai/api/v1/models):

    supported_parameters      does it take temperature? tools?
    reasoning.mandatory       can reasoning be switched off?
    reasoning.supported_efforts / default_effort
                              which effort levels exist (low … max)
    reasoning.supports_max_tokens
                              budget-based reasoning (Qwen-style) instead of levels

The catalog is fetched without a key and cached on disk for a day.
"""

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from .storage.config import get_app_data_dir

CATALOG_URL = "https://openrouter.ai/api/v1/models"
BASE_URL = "https://openrouter.ai/api/v1"
CACHE_TTL_SECONDS = 24 * 3600

# App attribution (shown on openrouter.ai rankings; optional for the API).
HEADERS = {
    "HTTP-Referer": "https://github.com/Rann27/lwntl",
    "X-OpenRouter-Title": "LWNTL",
    "X-Title": "LWNTL",
}

EFFORT_ORDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max"]
# Budget for models that reason by token budget rather than by level.
EFFORT_BUDGET = {"minimal": 1024, "low": 2048, "medium": 8192, "high": 16384, "xhigh": 24576, "max": 32768}

_memory: Dict[str, Any] = {"at": 0.0, "models": None}


def _cache_path() -> Path:
    return get_app_data_dir() / "openrouter_models.json"


def _fetch() -> List[Dict[str, Any]]:
    import httpx
    resp = httpx.get(CATALOG_URL, timeout=30.0, headers=HEADERS)
    resp.raise_for_status()
    return resp.json().get("data") or []


def get_catalog(force: bool = False) -> List[Dict[str, Any]]:
    """Full model list, from memory, disk cache, or the network (in that order)."""
    now = time.time()
    if not force and _memory["models"] is not None and now - _memory["at"] < CACHE_TTL_SECONDS:
        return _memory["models"]

    path = _cache_path()
    if not force and path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if now - data.get("at", 0) < CACHE_TTL_SECONDS:
                _memory.update(at=data["at"], models=data["models"])
                return data["models"]
        except Exception:
            pass

    try:
        models = _fetch()
    except Exception:
        # Offline: an old cache beats nothing.
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                _memory.update(at=data.get("at", 0), models=data["models"])
                return data["models"]
            except Exception:
                pass
        raise
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"at": now, "models": models}, ensure_ascii=False), encoding="utf-8")
    _memory.update(at=now, models=models)
    return models


def get_model_meta(model_id: str) -> Optional[Dict[str, Any]]:
    try:
        catalog = get_catalog()
    except Exception:
        return None
    return next((m for m in catalog if m.get("id") == model_id), None)


def _per_million(value: Any) -> Optional[float]:
    try:
        return round(float(value) * 1_000_000, 4)
    except (TypeError, ValueError):
        return None


def compact_catalog(force: bool = False) -> Dict[str, Any]:
    """What the model picker needs, newest first."""
    models = []
    for m in get_catalog(force):
        params = m.get("supported_parameters") or []
        pricing = m.get("pricing") or {}
        reasoning = m.get("reasoning") or {}
        models.append({
            "id": m.get("id"),
            "name": m.get("name") or m.get("id"),
            "created": m.get("created") or 0,
            "context": m.get("context_length"),
            "maxOutput": (m.get("top_provider") or {}).get("max_completion_tokens"),
            "priceIn": _per_million(pricing.get("prompt")),
            "priceOut": _per_million(pricing.get("completion")),
            "priceCacheRead": _per_million(pricing.get("input_cache_read")),
            "tools": "tools" in params,
            "temperature": "temperature" in params,
            "reasoning": bool(reasoning) or "reasoning" in params,
            "reasoningMandatory": bool(reasoning.get("mandatory")),
            "efforts": reasoning.get("supported_efforts") or [],
            "defaultEffort": reasoning.get("default_effort") or "",
            "budgetReasoning": bool(reasoning.get("supports_max_tokens")),
            "expires": m.get("expiration_date"),
        })
    models.sort(key=lambda x: -x["created"])
    return {"models": models, "fetchedAt": _memory.get("at") or 0}


def _nearest_effort(wanted: str, supported: List[str]) -> Optional[str]:
    """The supported level closest to `wanted`; a tie goes to the level nearer "high"."""
    if not supported:
        return None
    if wanted in supported:
        return wanted
    if wanted not in EFFORT_ORDER:
        return None
    w = EFFORT_ORDER.index(wanted)
    h = EFFORT_ORDER.index("high")
    ranked = sorted((s for s in supported if s in EFFORT_ORDER),
                    key=lambda s: (abs(EFFORT_ORDER.index(s) - w), abs(EFFORT_ORDER.index(s) - h)))
    return ranked[0] if ranked else None


def request_profile(model_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
    """
    What to send for this model, given the user's OpenRouter settings.

    Returns {"extra_body", "temperature" (bool), "notes" [str]} — notes explain
    every adjustment so the settings screen can show it.
    """
    meta = get_model_meta(model_id) or {}
    params = meta.get("supported_parameters") or []
    reasoning = meta.get("reasoning") or {}
    notes: List[str] = []
    body: Dict[str, Any] = {}

    want = (config.get("openrouterReasoning") or "default").strip()
    efforts = reasoning.get("supported_efforts") or []
    has_reasoning = bool(reasoning) or "reasoning" in params

    if not meta:
        notes.append("Model tidak ada di katalog (atau katalog belum dimuat) — parameter dikirim apa adanya.")
    if want == "default" or not has_reasoning:
        if want != "default" and not has_reasoning:
            notes.append("Model ini tidak punya mode reasoning — pengaturan reasoning diabaikan.")
    elif want == "off":
        if reasoning.get("mandatory"):
            notes.append("Reasoning wajib di model ini — tidak bisa dimatikan, memakai default model.")
        else:
            body["reasoning"] = {"enabled": False}
    elif efforts:
        level = _nearest_effort(want, efforts)
        if level:
            body["reasoning"] = {"effort": level}
            if level != want:
                notes.append(f"Effort '{want}' tidak tersedia; memakai '{level}' (didukung: {', '.join(efforts)}).")
    elif reasoning.get("supports_max_tokens"):
        budget = EFFORT_BUDGET.get(want, EFFORT_BUDGET["high"])
        body["reasoning"] = {"max_tokens": budget}
        notes.append(f"Model memakai anggaran token reasoning: '{want}' → {budget} token.")
    else:
        body["reasoning"] = {"enabled": True}

    provider: Dict[str, Any] = {}
    sort = (config.get("openrouterSort") or "").strip()
    if sort in ("price", "throughput", "latency"):
        provider["sort"] = sort
    if config.get("openrouterDenyDataCollection"):
        provider["data_collection"] = "deny"
    if provider:
        body["provider"] = provider

    send_temperature = (not meta) or ("temperature" in params)
    if meta and not send_temperature:
        notes.append("Model tidak menerima temperature — tidak dikirim.")
    return {"extra_body": body, "temperature": send_temperature, "notes": notes}
