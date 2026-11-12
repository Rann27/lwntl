"""
Model Catalog — each provider's model list, fetched from the provider itself.

The pickers used to show a hardcoded list per provider, so every new model meant
a code change. Providers publish their own lists; this module asks them:

    OpenAI-style /models    OpenAI, DeepSeek, xAI, Moonshot, Qwen (DashScope), Z.AI,
                            MiMo, Experiential Labs, UncensoredLLM, OpenAI Compatible
    Gemini native list      displayName, input/output token limits, thinking support
    Anthropic /v1/models    display_name, context and output limits when given
    OpenRouter catalog      core/openrouter.py (public, no key)
    ChatGPT plan catalog    core/chatgpt_auth.py (visible models of the plan)

Lists are cached on disk for a day per provider (and per base URL / region where
that changes the answer). Without a key, or when the provider does not answer,
the built-in list from llm_client.PROVIDERS is returned and marked as such.

What the request rules need (reasoning effort, temperature) still lives in
llm_client.request_profile, keyed on model id patterns, so a newly listed model of
a known family is sent correctly without a code change.
"""

import json
import re
import time
from typing import Any, Dict, List, Optional

import httpx

from .storage.config import get_app_data_dir

CACHE_TTL_SECONDS = 24 * 3600
TIMEOUT = 20

# Endpoints whose /models also lists embeddings, speech, images, moderation …
# none of which can translate a chapter.
_NOT_CHAT = re.compile(
    r"embed|whisper|tts|speech|dall-e|davinci|babbage|moderation|transcri|realtime|audio|"
    r"(^|[-_])image|imagen|veo|sora|rerank|wanx|paraformer|sambert|cosyvoice|ocr|aqa|"
    r"computer-use|search-preview|text-similarity|clip|stable-diffusion|flux|video|imagine|"
    r"(^|[-_])asr($|[-_])",
    re.I,
)

# Base URL for each OpenAI-style provider's /models.
_OPENAI_STYLE = {
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com",
    "xai": "https://api.x.ai/v1",
    "qwen": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "zhipuai": "https://api.z.ai/api/paas/v4",
    "mimo": "https://api.xiaomimimo.com/v1",
    "experiential": "https://api.experientiallabs.ai/v1",
    "uncensoredllm": "https://api.uncensoredllm.ai/v1",
}


def _cache_path():
    return get_app_data_dir() / "model_catalog.json"


def _load_cache() -> Dict[str, Any]:
    try:
        return json.loads(_cache_path().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _save_cache(cache: Dict[str, Any]):
    path = _cache_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")


def _model(mid: str, name: str = "", **info: Any) -> Dict[str, Any]:
    out = {"id": mid, "name": name or mid}
    out.update({k: v for k, v in info.items() if v not in (None, "", [], {})})
    return out


def _first(d: Dict[str, Any], *keys: str) -> Any:
    return next((d[k] for k in keys if d.get(k) not in (None, "")), None)


# ---------------------------------------------------------------------------
# Fetchers
# ---------------------------------------------------------------------------

def _fetch_openai_style(base_url: str, api_key: str, headers: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    h = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    h.update(headers or {})
    r = httpx.get(base_url.rstrip("/") + "/models", headers=h, timeout=TIMEOUT)
    r.raise_for_status()
    body = r.json()
    items = body.get("data") if isinstance(body, dict) else body
    out = []
    for it in items or []:
        mid = it.get("id") if isinstance(it, dict) else None
        if not mid or _NOT_CHAT.search(mid):
            continue
        out.append(_model(
            mid,
            _first(it, "display_name", "name") or "",
            created=it.get("created"),
            ownedBy=it.get("owned_by"),
            contextLength=_first(it, "context_length", "context_window", "max_model_len", "max_input_tokens"),
            maxOutput=_first(it, "max_output_tokens", "max_completion_tokens", "max_tokens"),
            description=it.get("description"),
        ))
    return out


def _fetch_gemini(api_key: str) -> List[Dict[str, Any]]:
    r = httpx.get("https://generativelanguage.googleapis.com/v1beta/models",
                  params={"key": api_key, "pageSize": 1000}, timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for it in r.json().get("models") or []:
        mid = (it.get("name") or "").removeprefix("models/")
        if not mid or "generateContent" not in (it.get("supportedGenerationMethods") or []) or _NOT_CHAT.search(mid):
            continue
        out.append(_model(mid, it.get("displayName") or "", contextLength=it.get("inputTokenLimit"),
                          maxOutput=it.get("outputTokenLimit"), description=it.get("description"),
                          thinking=it.get("thinking")))
    return out


def _fetch_anthropic(api_key: str) -> List[Dict[str, Any]]:
    r = httpx.get("https://api.anthropic.com/v1/models", params={"limit": 1000},
                  headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"}, timeout=TIMEOUT)
    r.raise_for_status()
    return [_model(it["id"], it.get("display_name") or "", created=it.get("created_at"),
                   contextLength=it.get("max_input_tokens"), maxOutput=it.get("max_tokens"))
            for it in r.json().get("data") or [] if it.get("id")]


def _fetch_openrouter() -> List[Dict[str, Any]]:
    from .openrouter import compact_catalog
    return [_model(m["id"], m.get("name") or "", contextLength=m.get("context"))
            for m in compact_catalog().get("models") or []]


def _fetch_chatgpt() -> List[Dict[str, Any]]:
    from .chatgpt_auth import list_models
    return [_model(m["id"], m.get("name") or "", description=m.get("description"),
                   contextLength=m.get("contextLength"), reasoningLevels=m.get("reasoningLevels"),
                   defaultReasoning=m.get("defaultReasoning"))
            for m in list_models()]


def cached_model(provider: str, model_id: str) -> Optional[Dict[str, Any]]:
    """A model's entry from the on-disk catalog, without touching the network."""
    for key, entry in _load_cache().items():
        if key == provider or key.startswith(provider + "|"):
            hit = next((m for m in entry.get("models") or [] if m.get("id") == model_id), None)
            if hit:
                return hit
    return None


def _target(provider: str, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """How to ask this provider: {"kind", "key", "base", "headers", "cacheKey"} or None."""
    from .llm_client import PROVIDERS

    meta = PROVIDERS.get(provider, {})
    key = config.get(meta.get("apiKeyName", ""), "") if meta.get("apiKeyName") else ""
    if provider == "deepseek":
        key = key or next((k.get("key") for k in config.get("deepseekApiKeys") or [] if k.get("key")), "")
    if provider == "chatgpt":
        return {"kind": "chatgpt", "cacheKey": "chatgpt"} if config.get("chatgptAccount") else None
    if provider == "openrouter":
        return {"kind": "openrouter", "cacheKey": "openrouter"}
    if provider == "gemini":
        return {"kind": "gemini", "key": key, "cacheKey": "gemini"} if key else None
    if provider == "anthropic":
        return {"kind": "anthropic", "key": key, "cacheKey": "anthropic"} if key else None
    if provider == "moonshot":
        base = meta.get("baseUrlChina") if config.get("moonshotRegion") == "china" else meta.get("baseUrl")
        return {"kind": "openai", "key": key, "base": base, "cacheKey": f"moonshot|{base}"} if key else None
    if provider == "openaicompat":
        base = (config.get("openaicompatBaseUrl") or "").strip()
        if not base:
            return None
        headers = dict(config.get("openaicompatExtraHeaders") or {})
        return {"kind": "openai", "key": key, "base": base, "headers": headers, "cacheKey": f"openaicompat|{base}"}
    if provider in _OPENAI_STYLE:
        return {"kind": "openai", "key": key, "base": _OPENAI_STYLE[provider], "cacheKey": provider} if key else None
    return None


def _static(provider: str) -> List[Dict[str, Any]]:
    from .llm_client import PROVIDERS
    meta = PROVIDERS.get(provider, {})
    names = meta.get("displayNames", {})
    return [_model(m, names.get(m, m)) for m in meta.get("models", []) if m != "custom"]


def list_models(provider: str, config: Dict[str, Any], refresh: bool = False) -> Dict[str, Any]:
    """
    {"models": [{id, name, contextLength?, maxOutput?, created?, description?}],
     "source": "live" | "cache" | "static", "fetchedAt": epoch | None, "error": str}
    """
    from .llm_client import PROVIDERS

    names = PROVIDERS.get(provider, {}).get("displayNames", {})
    target = _target(provider, config)
    if target is None:
        return {"models": _static(provider), "source": "static", "fetchedAt": None, "error": ""}

    cache = _load_cache()
    entry = cache.get(target["cacheKey"])
    if entry and not refresh and time.time() - entry.get("fetchedAt", 0) < CACHE_TTL_SECONDS:
        return {"models": entry["models"], "source": "cache", "fetchedAt": entry["fetchedAt"], "error": ""}

    try:
        kind = target["kind"]
        if kind == "openai":
            models = _fetch_openai_style(target["base"], target.get("key", ""), target.get("headers"))
        elif kind == "gemini":
            models = _fetch_gemini(target["key"])
        elif kind == "anthropic":
            models = _fetch_anthropic(target["key"])
        elif kind == "openrouter":
            models = _fetch_openrouter()
        else:
            models = _fetch_chatgpt()
        if not models:
            raise ValueError("provider returned no chat models")
        # Known display names are friendlier than raw ids the provider gives back.
        for m in models:
            if m["name"] == m["id"] and m["id"] in names:
                m["name"] = names[m["id"]]
        # Models LWNTL already knows first (tested request rules), then newest first
        # where the provider dates them, otherwise in the provider's own order.
        known = {m for m in PROVIDERS.get(provider, {}).get("models", [])}
        order = {m["id"]: i for i, m in enumerate(models)}
        models.sort(key=lambda m: (m["id"] not in known,
                                   -m["created"] if isinstance(m.get("created"), (int, float)) else 0,
                                   order[m["id"]]))
        now = time.time()
        cache[target["cacheKey"]] = {"fetchedAt": now, "models": models}
        _save_cache(cache)
        return {"models": models, "source": "live", "fetchedAt": now, "error": ""}
    except Exception as e:
        msg = str(e)[:200]
        if entry:
            return {"models": entry["models"], "source": "cache", "fetchedAt": entry["fetchedAt"], "error": msg}
        return {"models": _static(provider), "source": "static", "fetchedAt": None, "error": msg}
