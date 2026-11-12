"""
LLM Client - Unified Multi-Provider Support
Supports: ZhipuAI, Qwen, OpenAI, Google Gemini, Anthropic, xAI (Grok), Moonshot (Kimi), DeepSeek
"""

import json
import re
import time
from typing import Dict, List, Any, Optional

# DeepSeek thinking depth. "low" was added with the 2026-08-13 V4 update.
DEEPSEEK_EFFORTS = ("low", "high", "max")

# Retired DeepSeek model IDs and what now serves them.
DEEPSEEK_MODEL_ALIASES = {
    "deepseek-v4-flash": "deepseek-flash",
    "deepseek-v4-flash-vision-exp": "deepseek-flash",
}

# The four harm categories Gemini lets developers adjust. Child-safety and other
# core protections are enforced by Google and cannot be changed from here.
GEMINI_SAFETY_CATEGORIES = (
    "HARM_CATEGORY_HARASSMENT",
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
)

# Loosest first. "OFF" turns filtering off outright and is what current models
# accept; "BLOCK_NONE" is the older equivalent, kept as a fallback for models that
# reject "OFF".
GEMINI_SAFETY_THRESHOLDS = ("OFF", "BLOCK_NONE")


def _gemini_safety_body(threshold: str) -> Dict[str, Any]:
    return {
        "google": {
            "safety_settings": [
                {"category": c, "threshold": threshold}
                for c in GEMINI_SAFETY_CATEGORIES
            ]
        }
    }


def _tool_call_to_dict(tc: Any) -> Dict[str, Any]:
    """Normalise an OpenAI-style tool call into {id, name, arguments(dict)}."""
    fn = tc.function
    raw = fn.arguments or "{}"
    try:
        args = json.loads(raw) if isinstance(raw, str) else dict(raw)
    except Exception:
        # Malformed JSON from the model: hand it to the tool layer as-is so the
        # agent sees a clear error and can retry.
        args = {"__raw__": raw}
    if not isinstance(args, dict):
        args = {"__raw__": raw}
    return {"id": tc.id or "", "name": fn.name or "", "arguments": args}


# Model lists as of 2026-10 (verified against each provider's docs). Retired or
# access-limited IDs are dropped from the pickers; a worker still pointing at one
# keeps working as a custom model ID until the provider shuts it off.
PROVIDERS = {
    "zhipuai": {
        "models": ["glm-5.3", "glm-5.3-flashx", "glm-5.3-flash", "glm-5.2", "glm-5.1", "glm-4.7-flash", "custom"],
        "displayNames": {
            "glm-5.3": "GLM-5.3",
            "glm-5.3-flashx": "GLM-5.3-FlashX",
            "glm-5.3-flash": "GLM-5.3-Flash",
            "glm-5.2": "GLM-5.2",
            "glm-5.1": "GLM-5.1",
            "glm-4.7-flash": "GLM-4.7-Flash (Free)",
            "custom": "+ Custom Model",
        },
        "label": "ZhipuAI (Z.AI)",
        "docsUrl": "https://docs.z.ai/guides/overview/pricing",
        "apiKeyName": "zhipuaiApiKey",
    },
    "qwen": {
        "models": ["qwen3.8-max", "qwen3.8-flash", "qwen3.7-plus", "qwen3.7-flash", "custom"],
        "displayNames": {
            "qwen3.8-max": "Qwen3.8-Max",
            "qwen3.8-flash": "Qwen3.8-Flash",
            "qwen3.7-plus": "Qwen3.7-Plus",
            "qwen3.7-flash": "Qwen3.7-Flash",
            "custom": "+ Custom Model",
        },
        "baseUrl": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "label": "Alibaba Cloud (Qwen)",
        "docsUrl": "https://www.alibabacloud.com/help/en/model-studio/models",
        "apiKeyName": "qwenApiKey",
    },
    "openai": {
        "models": ["gpt-6.1-sol", "gpt-6-astra", "gpt-6-luna", "custom"],
        "displayNames": {
            "gpt-6.1-sol": "GPT-6.1 Sol",
            "gpt-6-astra": "GPT-6 Astra",
            "gpt-6-luna": "GPT-6 Luna",
            "custom": "+ Custom Model",
        },
        "label": "OpenAI",
        "docsUrl": "https://developers.openai.com/api/docs/models",
        "apiKeyName": "openaiApiKey",
    },
    "gemini": {
        "models": ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite",
                   "gemini-3.1-pro-preview", "custom"],
        "displayNames": {
            "gemini-3.8-flash": "Gemini 3.8 Flash",
            "gemini-3.6-flash": "Gemini 3.6 Flash",
            "gemini-3.5-flash-lite": "Gemini 3.5 Flash Lite",
            "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
            "gemini-3.1-pro-preview": "Gemini 3.1 Pro (Preview)",
            "custom": "+ Custom Model",
        },
        "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "label": "Google Gemini",
        "docsUrl": "https://ai.google.dev/gemini-api/docs/models",
        "apiKeyName": "geminiApiKey",
    },
    "anthropic": {
        "models": ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1", "custom"],
        "displayNames": {
            "claude-opus-5-5": "Claude Opus 5.5",
            "claude-sonnet-5-5": "Claude Sonnet 5.5",
            "claude-haiku-5-5": "Claude Haiku 5.5",
            "claude-fable-5-1": "Claude Fable 5.1",
            "custom": "+ Custom Model",
        },
        "label": "Anthropic (Claude)",
        "docsUrl": "https://platform.claude.com/docs/en/about-claude/models/overview",
        "apiKeyName": "anthropicApiKey",
    },
    "xai": {
        "models": ["grok-4.7", "grok-4.6", "grok-4.5", "grok-4.3", "grok-4.20-0309-reasoning",
                   "grok-4.20-0309-non-reasoning", "custom"],
        "displayNames": {
            "grok-4.7": "Grok 4.7",
            "grok-4.6": "Grok 4.6",
            "grok-4.5": "Grok 4.5",
            "grok-4.3": "Grok 4.3",
            "grok-4.20-0309-reasoning": "Grok 4.20 (reasoning)",
            "grok-4.20-0309-non-reasoning": "Grok 4.20 (non-reasoning)",
            "custom": "+ Custom Model",
        },
        "baseUrl": "https://api.x.ai/v1",
        "label": "xAI (Grok)",
        "docsUrl": "https://docs.x.ai/docs/models",
        "apiKeyName": "xaiApiKey",
    },
    "moonshot": {
        "models": ["kimi-k3", "kimi-k2.6", "kimi-k2.7-code", "custom"],
        "displayNames": {
            "kimi-k3": "Kimi K3",
            "kimi-k2.6": "Kimi K2.6",
            "kimi-k2.7-code": "Kimi K2.7 Code",
            "custom": "+ Custom Model",
        },
        # International platform; keys from the China platform need the .cn URL
        # (switchable in Settings).
        "baseUrl": "https://api.moonshot.ai/v1",
        "baseUrlChina": "https://api.moonshot.cn/v1",
        "label": "Moonshot AI (Kimi)",
        "docsUrl": "https://platform.kimi.ai/docs/api/models-overview",
        "apiKeyName": "moonshotApiKey",
    },
    "deepseek": {
        # deepseek-flash is DeepSeek-V4.1-Flash (2026-09-10). The old
        # deepseek-v4-flash name is retired and only routed temporarily, so it is
        # migrated away from in config rather than offered here.
        "models": ["deepseek-flash", "deepseek-v4-pro"],
        "displayNames": {
            "deepseek-flash": "DeepSeek V4.1 Flash",
            "deepseek-v4-pro": "DeepSeek V4 Pro",
            # Legacy IDs, kept only so an unmigrated worker still displays sensibly.
            "deepseek-v4-flash": "DeepSeek V4 Flash (legacy → V4.1)",
            "deepseek-v4-flash-vision-exp": "DeepSeek V4 Flash Vision (legacy → V4.1)",
        },
        "baseUrl": "https://api.deepseek.com",
        "label": "DeepSeek",
        "docsUrl": "https://api-docs.deepseek.com/",
        "apiKeyName": "deepseekApiKey",
    },
    "mimo": {
        "models": ["mimo-v2.6-pro", "mimo-v2.6-flash", "mimo-v2.5-pro", "mimo-v2.5"],
        "displayNames": {
            "mimo-v2.6-pro": "MiMo V2.6 Pro",
            "mimo-v2.6-flash": "MiMo V2.6 Flash",
            "mimo-v2.5-pro": "MiMo V2.5 Pro",
            "mimo-v2.5": "MiMo V2.5",
        },
        "baseUrl": "https://api.xiaomimimo.com/v1",
        "label": "Xiaomi MiMo",
        "docsUrl": "https://platform.xiaomimimo.com/docs/en-US/welcome",
        "apiKeyName": "mimoApiKey",
    },
    "chatgpt": {
        # Runs on the user's ChatGPT plan through Sign in with ChatGPT (see
        # core/chatgpt_auth.py) — no API key. Models come from the plan's own
        # catalog; these are only the offline fallback.
        "models": ["gpt-6.1-sol", "gpt-6-astra", "gpt-6-luna"],
        "displayNames": {
            "gpt-6.1-sol": "GPT-6.1 Sol",
            "gpt-6-astra": "GPT-6 Astra",
            "gpt-6-luna": "GPT-6 Luna",
        },
        "baseUrl": "https://api.openai.com/v1",
        "label": "ChatGPT (paket langganan)",
        "docsUrl": "https://chatgpt.com/settings/usage",
        # Set to the signed-in account's email; empty = not connected.
        "apiKeyName": "chatgptAccount",
    },
    "experiential": {
        # OpenAI-compatible gateway; the model list comes from its /models.
        "models": ["glm-5.3"],
        "displayNames": {"glm-5.3": "GLM-5.3"},
        "baseUrl": "https://api.experientiallabs.ai/v1",
        "label": "Experiential Labs",
        "docsUrl": "https://platform.experientiallabs.ai/docs/reference",
        "apiKeyName": "experientialApiKey",
    },
    "uncensoredllm": {
        # OpenAI-compatible; abliterated open-weight models.
        "models": ["glm-5.3-uncensored"],
        "displayNames": {"glm-5.3-uncensored": "GLM-5.3 Uncensored"},
        "baseUrl": "https://api.uncensoredllm.ai/v1",
        "label": "UncensoredLLM",
        "docsUrl": "https://uncensoredllm.ai/docs",
        "apiKeyName": "uncensoredllmApiKey",
    },
    "openrouter": {
        # The model list is the live OpenRouter catalog (see core/openrouter.py).
        "models": [],
        "displayNames": {},
        "baseUrl": "https://openrouter.ai/api/v1",
        "label": "OpenRouter",
        "docsUrl": "https://openrouter.ai/models",
        "apiKeyName": "openrouterApiKey",
    },
    "openaicompat": {
        "models": [],
        "displayNames": {},
        "label": "OpenAI Compatible",
        "docsUrl": "",
        "apiKeyName": "openaicompatApiKey",
    },
}

# Shut down by the provider; the successor is the same model line.
MODEL_ALIASES = {
    "gemini": {"gemini-3.1-flash-lite-preview": "gemini-3.1-flash-lite"},
}


# ─── Per-model request rules ────────────────────────────────────────────────

_EFFORT_LEVELS = ("none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra")


def _clamp_effort(wanted: str, allowed: tuple) -> str:
    """Nearest allowed level to `wanted`; a tie goes to the level nearer "high"."""
    if wanted in allowed:
        return wanted
    w = _EFFORT_LEVELS.index(wanted) if wanted in _EFFORT_LEVELS else _EFFORT_LEVELS.index("high")
    h = _EFFORT_LEVELS.index("high")
    return min(allowed, key=lambda a: (abs(_EFFORT_LEVELS.index(a) - w), abs(_EFFORT_LEVELS.index(a) - h)))


def request_profile(config: Dict[str, Any], provider: str, model: str) -> Dict[str, Any]:
    """
    Exactly what LWNTL sends for this provider + model, and why.

    Returns {"extra_body": dict|None, "temperature": bool, "max_tokens_key": str,
             "base_url": str|None, "notes": [str], "gemini_relaxed": bool}.
    Used by LLMClient when it builds requests and by the settings screen, so the
    preview and the real request can never disagree.
    """
    m = (model or "").lower()
    notes: List[str] = []
    extra: Dict[str, Any] = {}
    temperature = True
    max_tokens_key = "max_tokens"
    base_url = PROVIDERS.get(provider, {}).get("baseUrl")
    relaxed = False

    if provider == "zhipuai":
        # GLM thinks by default. GLM-5.3 and 5.3-Flash force it and reject "disabled".
        forced = m in ("glm-5.3", "glm-5.3-flash")
        thinking = config.get("zhipuaiThinking", True)
        if not thinking:
            if forced:
                notes.append("GLM-5.3 / 5.3-Flash selalu berpikir — thinking tidak bisa dimatikan.")
            else:
                extra["thinking"] = {"type": "disabled"}
        # reasoning_effort (top-level, default "max") exists from GLM-5.2. GLM-5.3 and
        # 5.3-Flash take only low/high/max; 5.2 and 5.3-FlashX take the full range.
        effort = config.get("zhipuaiReasoningEffort") or "default"
        if effort != "default" and (thinking or forced):
            if forced:
                allowed = ("low", "high", "max")
            elif m.startswith(("glm-5.2", "glm-5.3")):
                allowed = ("minimal", "low", "medium", "high", "xhigh", "max")
            else:
                allowed = ()
                notes.append(f"{model} tidak menerima reasoning_effort (mulai GLM-5.2) — tidak dikirim.")
            if allowed:
                level = _clamp_effort(effort, allowed)
                if level != effort:
                    notes.append(f"Effort '{effort}' tidak tersedia di {model}; memakai '{level}'.")
                extra["reasoning_effort"] = level

    elif provider == "qwen":
        # Qwen3.7/3.8 think by default; enable_thinking=false answers directly.
        if not config.get("qwenThinking", True):
            extra["enable_thinking"] = False

    elif provider == "openai":
        # GPT-5/6 and o-series are reasoning models: temperature is rejected and
        # the output cap is max_completion_tokens (accepted by every chat model).
        max_tokens_key = "max_completion_tokens"
        reasoning_model = m.startswith(("gpt-5", "gpt-6", "o1", "o3", "o4"))
        if reasoning_model:
            temperature = False
            notes.append("Model reasoning OpenAI tidak menerima temperature — tidak dikirim.")
        effort = config.get("openaiReasoningEffort") or "default"
        if reasoning_model and effort != "default":
            allowed = ("none", "low", "medium", "high", "xhigh", "max") if "luna" in m else ("low", "medium", "high", "xhigh", "max")
            level = _clamp_effort(effort, allowed)
            if level != effort:
                notes.append(f"Effort '{effort}' tidak tersedia di {model}; memakai '{level}'.")
            extra["reasoning_effort"] = level

    elif provider == "gemini":
        if not config.get("geminiSafetyFilter", True):
            extra.update(_gemini_safety_body("OFF"))
            relaxed = True
        effort = config.get("geminiReasoningEffort") or "default"
        if effort != "default":
            # Gemini 3 cannot turn thinking off; low/medium/high map to thinking_level.
            extra["reasoning_effort"] = _clamp_effort(effort, ("low", "medium", "high"))

    elif provider == "anthropic":
        # Claude 4.7+ and 5.x reject non-default temperature/top_p/top_k.
        if re.search(r"claude-(opus|sonnet|haiku)-5|claude-(fable|mythos)|claude-opus-4-[78]", m):
            temperature = False
            notes.append("Claude generasi ini menolak temperature — tidak dikirim (atur lewat effort).")
        effort = config.get("anthropicEffort") or "default"
        if effort != "default":
            allowed = ("low", "medium", "high", "max") if "opus-4-6" in m or "sonnet-4-6" in m else ("low", "medium", "high", "xhigh", "max")
            extra["output_config"] = {"effort": _clamp_effort(effort, allowed)}

    elif provider == "xai":
        # Only the 4.5+ line takes reasoning_effort; xhigh exists from 4.6.
        effort = config.get("xaiReasoningEffort") or "high"
        if m.startswith(("grok-4.6", "grok-4.7")):
            extra["reasoning_effort"] = _clamp_effort(effort, ("low", "medium", "high", "xhigh"))
        elif m.startswith("grok-4.5"):
            extra["reasoning_effort"] = _clamp_effort(effort, ("low", "medium", "high"))
        else:
            notes.append("Model ini tidak menerima reasoning_effort — tidak dikirim.")

    elif provider == "moonshot":
        if config.get("moonshotRegion") == "china":
            base_url = PROVIDERS["moonshot"]["baseUrlChina"]
        if m.startswith("kimi-k"):
            # Kimi K2.6+/K3 lock temperature to 1.0 and top_p to 0.95.
            temperature = False
            notes.append("Kimi mengunci temperature di 1.0 — tidak dikirim.")
        if m.startswith("kimi-k3"):
            effort = config.get("moonshotReasoningEffort") or "default"
            if effort != "default":
                extra["reasoning_effort"] = _clamp_effort(effort, ("low", "high", "max"))
        elif m.startswith("kimi-k2.6"):
            extra["thinking"] = {"type": "enabled" if config.get("moonshotThinking", True) else "disabled"}

    elif provider == "deepseek":
        # Thinking is ON by default server-side, so it is always sent explicitly.
        # reasoning_effort is a TOP-LEVEL field. While thinking, temperature and
        # the penalties are ignored.
        if config.get("deepseekThinking", False):
            effort = config.get("deepseekReasoningEffort", "high")
            extra.update({"thinking": {"type": "enabled"},
                          "reasoning_effort": effort if effort in DEEPSEEK_EFFORTS else "high"})
            notes.append("Thinking aktif — DeepSeek mengabaikan temperature.")
        else:
            extra["thinking"] = {"type": "disabled"}

    elif provider == "mimo":
        thinking = config.get("mimoThinking", True)
        if m.startswith("mimo-v2.6"):
            # V2.6 is controlled by thinking.type only.
            extra["thinking"] = {"type": "enabled" if thinking else "disabled"}
        elif thinking:
            extra.update({"chat_template_kwargs": {"enable_thinking": True},
                          "reasoning_effort": config.get("mimoReasoningEffort", "medium")})
        else:
            extra["chat_template_kwargs"] = {"enable_thinking": False}

    elif provider == "chatgpt":
        # ChatGPT-plan requests reject temperature and max_output_tokens outright.
        temperature = False
        notes.append("Paket ChatGPT tidak menerima temperature dan batas output — keduanya tidak dikirim.")
        # No plan model can switch reasoning off; LOW is the lightest. Levels come
        # from the plan's own catalog per model (some stop at MAX, others reach ULTRA).
        effort = config.get("chatgptReasoningEffort") or "default"
        if effort != "default":
            from .model_catalog import cached_model
            meta = cached_model("chatgpt", model) or {}
            allowed = tuple(lv for lv in meta.get("reasoningLevels") or [] if lv in _EFFORT_LEVELS) \
                or ("low", "medium", "high", "xhigh", "max")
            level = _clamp_effort(effort, allowed)
            if level != effort:
                notes.append(f"Reasoning '{effort}' tidak tersedia di {model}; memakai '{level}'.")
            extra["reasoning"] = {"effort": level}
        else:
            from .model_catalog import cached_model
            default = (cached_model("chatgpt", model) or {}).get("defaultReasoning")
            if default:
                notes.append(f"Reasoning mengikuti bawaan model: {default}.")

    elif provider == "openrouter":
        from .openrouter import request_profile as _or_profile
        prof = _or_profile(model, config)
        extra.update(prof["extra_body"])
        temperature = prof["temperature"]
        notes.extend(prof["notes"])

    return {
        "extra_body": extra or None,
        "temperature": temperature,
        "max_tokens_key": max_tokens_key,
        "base_url": base_url,
        "notes": notes,
        "gemini_relaxed": relaxed,
    }


def get_provider_models(provider: str) -> List[str]:
    """Get list of available models for a provider"""
    return PROVIDERS.get(provider, {}).get("models", [])


def get_model_display_name(provider: str, model: str) -> str:
    """Get display name for a model"""
    provider_config = PROVIDERS.get(provider, {})
    display_names = provider_config.get("displayNames", {})
    return display_names.get(model, model)


# ─── Anthropic stream adapter ───────────────────────────────────────────────

class _AnthropicDelta:
    def __init__(self, content: str):
        self.content = content
        self.reasoning_content = None

class _AnthropicChoice:
    def __init__(self, content: str):
        self.delta = _AnthropicDelta(content)

class _AnthropicChunk:
    """Makes Anthropic stream events look like OpenAI stream chunks."""
    def __init__(self, content: str):
        self.choices = [_AnthropicChoice(content)]

class _AnthropicUsage:
    def __init__(self, input_tokens: int, output_tokens: int):
        self.prompt_tokens = input_tokens
        self.completion_tokens = output_tokens
        self.total_tokens = input_tokens + output_tokens

class _AnthropicMessage:
    def __init__(self, content: str):
        self.content = content

class _AnthropicResponseChoice:
    def __init__(self, content: str):
        self.message = _AnthropicMessage(content)

class _AnthropicResponse:
    """Makes Anthropic response look like an OpenAI response."""
    def __init__(self, response):
        # With adaptive thinking the first block can be a thinking block.
        text = "".join(getattr(b, "text", "") for b in (response.content or []) if getattr(b, "type", "") == "text")
        self.choices = [_AnthropicResponseChoice(text)]
        self.usage = _AnthropicUsage(
            response.usage.input_tokens,
            response.usage.output_tokens,
        )


class _TextResponse:
    """A finished text reply in the OpenAI response shape (choices[0].message, usage)."""
    def __init__(self, text: str, input_tokens: int = 0, output_tokens: int = 0):
        self.choices = [_AnthropicResponseChoice(text)]
        self.usage = _AnthropicUsage(input_tokens, output_tokens)


_CHATGPT_ERRORS = {
    "subscription_sharing_usage_limit_exceeded":
        "Batas pemakaian paket ChatGPT tercapai — kelola di https://chatgpt.com/settings/usage",
    "subscription_sharing_user_not_eligible": "Paket ChatGPT akun ini tidak bisa dipakai di aplikasi lain",
    "subscription_sharing_usage_unavailable": "Pemakaian paket ChatGPT sedang tidak tersedia — coba lagi nanti",
    "subscription_sharing_user_unavailable": "Layanan paket ChatGPT sedang tidak tersedia — coba lagi nanti",
    "subscription_sharing_unsupported_capability": "Permintaan memakai fitur yang tidak didukung paket ChatGPT",
    "subscription_sharing_route_not_supported": "Endpoint ini tidak didukung untuk paket ChatGPT",
    "subscription_sharing_invalid_user": "Akses paket ChatGPT dicabut — hubungkan ulang di Settings → Provider",
    "chatpass_v2_scope_not_authorized": "Izin paket ChatGPT belum diberikan — hubungkan ulang di Settings → Provider",
}


def _anthropic_stream_generator(stream_ctx):
    """Yield OpenAI-compatible chunks from an Anthropic stream context manager."""
    with stream_ctx as stream:
        for text in stream.text_stream:
            yield _AnthropicChunk(text)


# ─── LLMClient ──────────────────────────────────────────────────────────────

class LLMClient:
    """Unified LLM client supporting multiple providers."""

    def __init__(self, config: Dict[str, Any]):
        self.provider = config.get("provider", "zhipuai")
        # Resolve actual model name (handle "custom" model key)
        raw_model = config.get("model", "glm-5")
        custom_models = config.get("customModels", {})
        if raw_model == "custom":
            self.model = custom_models.get(self.provider, "")
        else:
            self.model = raw_model
        if self.provider == "deepseek":
            # A config saved before the rename still works, but sends the current ID.
            self.model = DEEPSEEK_MODEL_ALIASES.get(self.model, self.model)
        self.model = MODEL_ALIASES.get(self.provider, {}).get(self.model, self.model)

        self.temperature = config.get("temperature", 0.3)
        self.max_tokens = config.get("maxTokensPerIteration", 16000)
        self.worker_label = config.get("workerLabel", "")
        self._log_callback = config.get("logCallback")
        self._client = None
        self._extra_body: Optional[Dict[str, Any]] = None  # provider-specific extra params (e.g. DeepSeek thinking)
        self._send_temperature = True
        self._max_tokens_key = "max_tokens"
        self._init_provider(config)

    def _close_current_client(self):
        """Close the current client if it exposes a close() method."""
        if self._client is None:
            return
        close_fn = getattr(self._client, "close", None)
        if callable(close_fn):
            try:
                close_fn()
            except Exception:
                pass

    def _build_openaicompat_headers(self, config: Dict[str, Any]) -> Dict[str, str]:
        """Build default headers for OpenAI-compatible provider only."""
        headers: Dict[str, str] = {}

        extra = config.get("openaicompatExtraHeaders", {})
        if isinstance(extra, dict):
            for k, v in extra.items():
                if k is None or v is None:
                    continue
                key = str(k).strip()
                value = str(v).strip()
                if key and value:
                    headers[key] = value

        ua = str(config.get("openaicompatUserAgent", "") or "").strip()
        client_name = str(config.get("openaicompatClientName", "") or "").strip()

        if ua:
            headers["User-Agent"] = ua
        if client_name:
            headers["X-Client-Name"] = client_name

        # Keep neutral defaults to avoid tool-impersonation anti-abuse heuristics.
        headers.setdefault("User-Agent", "lwntl/1.0 (+openai-compatible)")
        headers.setdefault("X-Client-Name", "lwntl")
        return headers

    def _init_provider(self, config: Dict[str, Any]):
        self._close_current_client()
        p = self.provider
        profile = request_profile(config, p, self.model)
        self._extra_body = profile["extra_body"]
        self._send_temperature = profile["temperature"]
        self._max_tokens_key = profile["max_tokens_key"]
        self._gemini_safety_relaxed = profile["gemini_relaxed"]
        self._gemini_threshold_index = 0
        for note in profile["notes"]:
            self._log(f"[Params] {note}")

        if p == "zhipuai":
            self._init_zhipuai(config.get("zhipuaiApiKey", ""))
        elif p == "anthropic":
            self._init_anthropic(config.get("anthropicApiKey", ""))
        elif p == "deepseek":
            self._init_openai_compat(self._resolve_deepseek_key(config), profile["base_url"])
        elif p == "openrouter":
            from .openrouter import HEADERS as _OR_HEADERS
            self._init_openai_compat(config.get("openrouterApiKey", ""), profile["base_url"],
                                     default_headers=dict(_OR_HEADERS))
        elif p == "chatgpt":
            from . import chatgpt_auth
            if not chatgpt_auth.status()["connected"]:
                raise ValueError("Akun ChatGPT belum terhubung — hubungkan di Settings → Provider")
            self._client = None
            self._client_type = "chatgpt"
        elif p == "openaicompat":
            self._init_openai_compat(
                config.get("openaicompatApiKey", ""),
                config.get("openaicompatBaseUrl", "") or None,
                default_headers=self._build_openaicompat_headers(config),
                optimize_stream=True,
            )
        elif p in PROVIDERS:
            key_name = PROVIDERS[p]["apiKeyName"]
            self._init_openai_compat(config.get(key_name, ""), profile["base_url"])
        else:
            raise ValueError(f"Unknown provider: {p}")

    def _sampling(self, kwargs: Dict[str, Any], max_tokens: int, temperature: Optional[float]) -> Dict[str, Any]:
        """Add the output cap and (where the model takes it) temperature."""
        kwargs[self._max_tokens_key] = max_tokens
        if self._send_temperature and temperature is not None:
            kwargs["temperature"] = temperature
        if self._extra_body:
            kwargs["extra_body"] = self._extra_body
        return kwargs

    def _downgrade_gemini_safety(self, error: Exception) -> bool:
        """Step the safety threshold down one level after a rejection.

        Returns True when the request is worth retrying. Only fires for Gemini
        while the relaxed setting is active, and only once per level, so an
        unrelated failure is never retried in a loop.
        """
        if self.provider != "gemini" or not getattr(self, "_gemini_safety_relaxed", False):
            return False
        idx = getattr(self, "_gemini_threshold_index", 0)
        if idx + 1 >= len(GEMINI_SAFETY_THRESHOLDS):
            return False
        msg = str(error).lower()
        # Must name the safety field specifically. Matching anything looser (e.g.
        # a bare "invalid") would swallow auth failures, which say "invalid api key".
        if "safety" not in msg and "threshold" not in msg:
            return False
        self._gemini_threshold_index = idx + 1
        # Swap only the safety block; reasoning_effort and the rest stay.
        self._extra_body = {**(self._extra_body or {}), **_gemini_safety_body(GEMINI_SAFETY_THRESHOLDS[idx + 1])}
        return True

    def _init_zhipuai(self, api_key: str):
        if not api_key:
            raise ValueError("ZhipuAI API key is required")
        from zai import ZaiClient
        self._client = ZaiClient(api_key=api_key)
        self._client_type = "zhipuai"

    def _resolve_deepseek_key(self, config: Dict[str, Any]) -> str:
        """Return the correct DeepSeek API key for this worker."""
        key_id = config.get("deepseekApiKeyId", "")
        keys = config.get("deepseekApiKeys", [])
        if key_id and keys:
            for entry in keys:
                if entry.get("id") == key_id:
                    return entry.get("key", "")
        if keys:
            return keys[0].get("key", "")
        return config.get("deepseekApiKey", "")

    def _init_openai_compat(
        self,
        api_key: str,
        base_url: Optional[str],
        default_headers: Optional[Dict[str, str]] = None,
        optimize_stream: bool = False,
    ):
        if not api_key and self.provider != "openaicompat":
            raise ValueError(f"{self.provider} API key is required")
        from openai import OpenAI
        import httpx

        kwargs: Dict[str, Any] = {"api_key": api_key or "not-required"}

        if optimize_stream:
            # OpenAI-compatible path tuning:
            # - keepalive pool to reduce repeated TCP/TLS handshake overhead
            # - HTTP/2 where supported to improve long streaming stability
            # - retries for transient connect errors
            import importlib.util
            http2_supported = importlib.util.find_spec("h2") is not None

            transport = httpx.HTTPTransport(retries=2)
            kwargs["http_client"] = httpx.Client(
                # Disable timeout entirely for long-running generations.
                timeout=None,
                limits=httpx.Limits(
                    max_connections=100,
                    max_keepalive_connections=20,
                    keepalive_expiry=120.0,
                ),
                http2=http2_supported,
                transport=transport,
            )
            if not http2_supported:
                self._log("[OpenAICompat] HTTP/2 disabled (package 'h2' not installed), using HTTP/1.1")
        else:
            # read=None: no per-chunk read timeout — slow models can pause
            # arbitrarily long mid-stream without the client killing the connection.
            kwargs["timeout"] = httpx.Timeout(connect=15.0, read=None, write=None, pool=None)

        if base_url:
            kwargs["base_url"] = base_url
        if default_headers:
            kwargs["default_headers"] = default_headers

        self._client = OpenAI(**kwargs)
        self._client_type = "openai"

        if optimize_stream and default_headers:
            self._log(
                "[OpenAICompat] Stream tuning enabled | default headers: "
                + ", ".join(default_headers.keys())
            )

    def _log(self, message: str):
        prefix = f"[{self.worker_label}] " if self.worker_label else ""
        line = prefix + message
        print(line)
        if callable(self._log_callback):
            try:
                self._log_callback(line)
            except Exception:
                pass

    def _init_anthropic(self, api_key: str):
        if not api_key:
            raise ValueError("Anthropic API key is required")
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self._client_type = "anthropic"

    def complete(
        self,
        messages: List[Dict[str, str]],
        stream: bool = True,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ):
        mt = max_tokens or self.max_tokens
        temp = temperature if temperature is not None else self.temperature
        input_chars = sum(len(m.get("content", "")) for m in messages)
        input_tokens_est = input_chars // 4
        mode_label = "stream" if stream else "sync"
        model_display = get_model_display_name(self.provider, self.model) if self.model in PROVIDERS.get(self.provider, {}).get("displayNames", {}) else self.model

        self._log(f"[API →] {self.provider} / {model_display} | {mode_label} | "
                  f"max_tokens={mt} | temp={temp if self._send_temperature else 'not sent'} | "
                  f"msgs={len(messages)} | ~{input_tokens_est} tok input")

        t0 = time.time()

        def _dispatch():
            if self._client_type == "zhipuai":
                return self._complete_zhipuai(messages, stream, mt, temp)
            elif self._client_type == "openai":
                return self._complete_openai(messages, stream, mt, temp)
            elif self._client_type == "anthropic":
                return self._complete_anthropic(messages, stream, mt, temp)
            elif self._client_type == "chatgpt":
                return self._complete_chatgpt(messages, stream)
            raise ValueError(f"Unknown client type: {self._client_type}")

        try:
            result = _dispatch()
        except Exception as e:
            # A model that predates the "OFF" threshold rejects the request outright.
            # Step down to the older BLOCK_NONE rather than failing the translation.
            if self._downgrade_gemini_safety(e):
                self._log("[Gemini] 'OFF' threshold rejected — retrying with BLOCK_NONE")
                result = _dispatch()
            else:
                raise

        if not stream:
            elapsed = time.time() - t0
            try:
                usage = result.usage
                self._log(f"[API ←] done in {elapsed:.1f}s | "
                          f"in={usage.prompt_tokens} out={usage.completion_tokens} "
                          f"total={usage.total_tokens} tok")
            except Exception:
                self._log(f"[API ←] done in {elapsed:.1f}s")

        return result

    def _complete_zhipuai(self, messages, stream, max_tokens, temperature):
        kwargs = self._sampling(dict(model=self.model, messages=messages, stream=stream), max_tokens, temperature)
        return self._client.chat.completions.create(**kwargs)

    def _complete_openai(self, messages, stream, max_tokens, temperature):
        kwargs = self._sampling(dict(model=self.model, messages=messages, stream=stream), max_tokens, temperature)
        return self._client.chat.completions.create(**kwargs)

    def _complete_anthropic(self, messages, stream, max_tokens, temperature):
        # Separate system message (Anthropic API uses a dedicated param)
        system_msg = ""
        user_messages = []
        for m in messages:
            if m["role"] == "system":
                system_msg = m["content"]
            else:
                user_messages.append(m)

        kwargs: Dict[str, Any] = dict(
            model=self.model,
            max_tokens=max_tokens,
            messages=user_messages,
        )
        if self._send_temperature and temperature is not None:
            kwargs["temperature"] = temperature
        if self._extra_body:
            kwargs["extra_body"] = self._extra_body
        if system_msg:
            kwargs["system"] = system_msg

        if stream:
            stream_ctx = self._client.messages.stream(**kwargs)
            return _anthropic_stream_generator(stream_ctx)
        else:
            response = self._client.messages.create(**kwargs)
            return _AnthropicResponse(response)

    # ------------------------------------------------------------------
    # ChatGPT plan — public Responses API (store=false, stream=true)
    # ------------------------------------------------------------------

    def _responses_events(self, body: Dict[str, Any]):
        """POST /v1/responses as the signed-in ChatGPT user; yield the stream's events."""
        import httpx
        from . import chatgpt_auth

        headers = {"Authorization": f"Bearer {chatgpt_auth.access_token()}",
                   "Content-Type": "application/json", "Accept": "text/event-stream"}
        timeout = httpx.Timeout(connect=15.0, read=None, write=None, pool=None)
        with httpx.Client(timeout=timeout) as http:
            with http.stream("POST", f"{chatgpt_auth.RESOURCE}/responses", headers=headers, json=body) as r:
                if r.status_code != 200:
                    raw = r.read().decode("utf-8", errors="replace")
                    try:
                        err = json.loads(raw).get("error") or {}
                    except Exception:
                        err = {}
                    code = err.get("code") if isinstance(err, dict) else ""
                    if r.status_code == 401 or code == "subscription_sharing_invalid_user":
                        chatgpt_auth.invalidate_session()
                    raise RuntimeError(_CHATGPT_ERRORS.get(code or "", "")
                                       or f"ChatGPT {r.status_code}: {(err.get('message') if isinstance(err, dict) else '') or raw[:300]}")
                for line in r.iter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload or payload == "[DONE]":
                        continue
                    try:
                        event = json.loads(payload)
                    except Exception:
                        continue
                    kind = event.get("type", "")
                    if kind in ("response.failed", "error"):
                        err = (event.get("response") or {}).get("error") or event.get("error") or event
                        code = err.get("code", "") if isinstance(err, dict) else ""
                        if code == "subscription_sharing_invalid_user":
                            chatgpt_auth.invalidate_session()
                        raise RuntimeError(_CHATGPT_ERRORS.get(code, "") or
                                           f"ChatGPT: {err.get('message', code) if isinstance(err, dict) else err}")
                    yield event

    def _responses_body(self, messages: List[Dict[str, Any]], extra_input: Optional[List[Dict[str, Any]]] = None,
                        tools: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        # System messages are rejected here; they travel as `instructions`.
        instructions = "\n\n".join(m.get("content", "") for m in messages if m.get("role") == "system")
        items = extra_input if extra_input is not None else [
            {"role": m["role"], "content": m.get("content", "")} for m in messages if m.get("role") != "system"
        ]
        body: Dict[str, Any] = {"model": self.model, "input": items, "store": False, "stream": True}
        if instructions:
            body["instructions"] = instructions
        if tools:
            body["tools"] = [{"type": "function", "name": t["name"], "description": t.get("description", ""),
                              "parameters": t.get("parameters", {"type": "object", "properties": {}})} for t in tools]
        if self._extra_body:
            body.update(self._extra_body)
        return body

    def _chatgpt_text_stream(self, body: Dict[str, Any]):
        self._chatgpt_usage = (0, 0)
        for event in self._responses_events(body):
            kind = event.get("type", "")
            if kind == "response.output_text.delta" and event.get("delta"):
                yield _AnthropicChunk(event["delta"])
            elif kind == "response.completed":
                usage = (event.get("response") or {}).get("usage") or {}
                self._chatgpt_usage = (usage.get("input_tokens", 0), usage.get("output_tokens", 0))

    def _complete_chatgpt(self, messages, stream):
        body = self._responses_body(messages)
        if stream:
            return self._chatgpt_text_stream(body)
        text = "".join(c.choices[0].delta.content for c in self._chatgpt_text_stream(body))
        return _TextResponse(text, *self._chatgpt_usage)

    def _chat_with_tools_chatgpt(self, messages, tools):
        """One agent turn on the Responses API: function tools, history replayed as input items."""
        items: List[Dict[str, Any]] = []
        for m in messages:
            role = m.get("role")
            if role == "system":
                continue
            if role == "tool":
                items.append({"type": "function_call_output", "call_id": m.get("tool_call_id", ""),
                              "output": m.get("content", "")})
            elif role == "assistant" and m.get("tool_calls"):
                if m.get("content"):
                    items.append({"role": "assistant", "content": m["content"]})
                for tc in m["tool_calls"]:
                    fn = tc.get("function", {})
                    items.append({"type": "function_call", "call_id": tc.get("id", ""),
                                  "name": fn.get("name", ""), "arguments": fn.get("arguments") or "{}"})
            else:
                items.append({"role": role, "content": m.get("content", "")})

        final: Dict[str, Any] = {}
        for event in self._responses_events(self._responses_body(messages, items, tools)):
            if event.get("type") == "response.completed":
                final = event.get("response") or {}
        text_parts: List[str] = []
        calls: List[Dict[str, Any]] = []
        for out in final.get("output") or []:
            if out.get("type") == "message":
                text_parts.extend(c.get("text", "") for c in out.get("content") or [] if c.get("type") == "output_text")
            elif out.get("type") == "function_call":
                try:
                    args = json.loads(out.get("arguments") or "{}")
                except Exception:
                    args = {}
                calls.append({"id": out.get("call_id", ""), "name": out.get("name", ""), "arguments": args})
        content = "".join(text_parts)
        assistant: Dict[str, Any] = {"role": "assistant", "content": content}
        if calls:
            assistant["tool_calls"] = [
                {"id": c["id"], "type": "function",
                 "function": {"name": c["name"], "arguments": json.dumps(c["arguments"], ensure_ascii=False)}}
                for c in calls
            ]
        return {"content": content, "tool_calls": calls, "assistant_message": assistant,
                "finish_reason": final.get("status", "")}

    # ------------------------------------------------------------------
    # Tool calling (agent sessions)
    # ------------------------------------------------------------------

    def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        One non-streaming turn with tools offered.

        `tools` use the OpenAI function schema: {"name", "description", "parameters"}.
        Returns {"content", "tool_calls": [{"id","name","arguments"}],
        "assistant_message", "finish_reason"}. `assistant_message` is the exact
        message to append to the history — it carries whatever the provider needs
        echoed back on the next turn (DeepSeek reasoning_content, Gemini thought
        signatures on the tool calls).
        """
        mt = max_tokens or min(self.max_tokens, 32000)
        temp = temperature if temperature is not None else self.temperature
        self._log(f"[Agent →] {self.provider} / {self.model} | tools={len(tools)} | msgs={len(messages)}")
        t0 = time.time()

        def _dispatch():
            if self._client_type == "anthropic":
                return self._chat_with_tools_anthropic(messages, tools, mt, temp)
            if self._client_type == "chatgpt":
                return self._chat_with_tools_chatgpt(messages, tools)
            kwargs = self._sampling(dict(
                model=self.model,
                messages=messages,
                tools=[{"type": "function", "function": t} for t in tools],
                tool_choice="auto",
            ), mt, temp)
            if self.provider == "openrouter":
                # Route only to upstreams that actually support tool calling.
                body = dict(kwargs.get("extra_body") or {})
                body["provider"] = {**(body.get("provider") or {}), "require_parameters": True}
                kwargs["extra_body"] = body
            response = self._client.chat.completions.create(**kwargs)
            choice = response.choices[0]
            msg = choice.message
            calls = [_tool_call_to_dict(tc) for tc in (msg.tool_calls or [])]
            assistant: Dict[str, Any] = {"role": "assistant", "content": msg.content or ""}
            if msg.tool_calls:
                assistant["tool_calls"] = [
                    tc.model_dump(exclude_none=True) if hasattr(tc, "model_dump") else tc
                    for tc in msg.tool_calls
                ]
            reasoning = getattr(msg, "reasoning_content", None)
            if reasoning:
                assistant["reasoning_content"] = reasoning
            # OpenRouter: reasoning must be handed back unmodified across tool turns.
            details = getattr(msg, "reasoning_details", None)
            if details:
                assistant["reasoning_details"] = details
            return {
                "content": msg.content or "",
                "tool_calls": calls,
                "assistant_message": assistant,
                "finish_reason": choice.finish_reason,
            }

        try:
            result = _dispatch()
        except Exception as e:
            if self._downgrade_gemini_safety(e):
                self._log("[Gemini] 'OFF' threshold rejected — retrying with BLOCK_NONE")
                result = _dispatch()
            else:
                raise
        self._log(f"[Agent ←] {time.time() - t0:.1f}s | tool_calls={len(result['tool_calls'])} "
                  f"| finish={result['finish_reason']}")
        return result

    def _chat_with_tools_anthropic(self, messages, tools, max_tokens, temperature):
        system_msg = ""
        converted: List[Dict[str, Any]] = []
        for m in messages:
            role = m.get("role")
            if role == "system":
                system_msg = m.get("content", "")
            elif role == "tool":
                block = {
                    "type": "tool_result",
                    "tool_use_id": m.get("tool_call_id", ""),
                    "content": m.get("content", ""),
                }
                # Consecutive tool results belong in one user turn.
                if converted and converted[-1]["role"] == "user" and isinstance(converted[-1]["content"], list) \
                        and converted[-1]["content"] and converted[-1]["content"][0].get("type") == "tool_result":
                    converted[-1]["content"].append(block)
                else:
                    converted.append({"role": "user", "content": [block]})
            elif role == "assistant" and m.get("anthropic_content"):
                # The exact blocks Claude produced, thinking included — they must
                # be returned unchanged while a tool loop continues.
                converted.append({"role": "assistant", "content": m["anthropic_content"]})
            elif role == "assistant" and m.get("tool_calls"):
                blocks: List[Dict[str, Any]] = []
                if m.get("content"):
                    blocks.append({"type": "text", "text": m["content"]})
                for tc in m["tool_calls"]:
                    fn = tc.get("function", {})
                    try:
                        args = json.loads(fn.get("arguments") or "{}")
                    except Exception:
                        args = {}
                    blocks.append({"type": "tool_use", "id": tc.get("id", ""), "name": fn.get("name", ""), "input": args})
                converted.append({"role": "assistant", "content": blocks})
            else:
                converted.append({"role": role, "content": m.get("content", "")})

        kwargs: Dict[str, Any] = dict(
            model=self.model,
            max_tokens=max_tokens,
            messages=converted,
            tools=[{"name": t["name"], "description": t.get("description", ""),
                    "input_schema": t.get("parameters", {"type": "object", "properties": {}})} for t in tools],
        )
        if system_msg:
            kwargs["system"] = system_msg
        if self._send_temperature and temperature is not None:
            kwargs["temperature"] = temperature
        if self._extra_body:
            kwargs["extra_body"] = self._extra_body
        response = self._client.messages.create(**kwargs)

        text_parts: List[str] = []
        calls: List[Dict[str, Any]] = []
        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                calls.append({"id": block.id, "name": block.name, "arguments": dict(block.input or {})})
        content = "".join(text_parts)
        assistant: Dict[str, Any] = {"role": "assistant", "content": content}
        try:
            assistant["anthropic_content"] = [b.model_dump(exclude_none=True) for b in response.content]
        except Exception:
            pass
        if calls:
            # Stored in OpenAI shape; converted back to tool_use blocks on the next turn.
            assistant["tool_calls"] = [
                {"id": c["id"], "type": "function",
                 "function": {"name": c["name"], "arguments": json.dumps(c["arguments"], ensure_ascii=False)}}
                for c in calls
            ]
        return {
            "content": content,
            "tool_calls": calls,
            "assistant_message": assistant,
            "finish_reason": response.stop_reason,
        }

    def update_config(self, config: Dict[str, Any]):
        old_provider = self.provider
        self.provider = config.get("provider", old_provider)
        raw_model = config.get("model", self.model)
        custom_models = config.get("customModels", {})
        if raw_model == "custom":
            self.model = custom_models.get(self.provider, "")
        else:
            self.model = raw_model
        self.temperature = config.get("temperature", self.temperature)
        self.max_tokens = config.get("maxTokensPerIteration", self.max_tokens)
        self.model = MODEL_ALIASES.get(self.provider, {}).get(self.model, self.model)
        # Parameters depend on provider AND model, so the profile is always rebuilt.
        self._init_provider(config)


def test_client(config: Dict[str, Any]) -> Dict[str, Any]:
    """Test if client can be initialized and make a simple API call."""
    try:
        client = LLMClient(config)
        messages = [{"role": "user", "content": "Hello! Please respond with 'OK'."}]
        # Always stream to avoid thinking-token budget issues
        # Reasoning models spend tokens thinking first; 20 would end before any text.
        stream = client.complete(messages, stream=True, max_tokens=1024)
        text = ""
        for chunk in stream:
            if hasattr(chunk, "choices") and chunk.choices:
                delta = chunk.choices[0].delta
                if hasattr(delta, "content") and delta.content:
                    text += delta.content
        if text.strip():
            return {"success": True, "message": "Koneksi berhasil", "response": text.strip()}
        return {"success": False, "message": "Respons kosong dari model", "error": "Empty response"}
    except ValueError as e:
        return {"success": False, "message": "Konfigurasi tidak valid", "error": str(e)}
    except Exception as e:
        return {"success": False, "message": "Gagal terhubung", "error": str(e)}
