"""
LLM Client - Unified Multi-Provider Support
Supports: ZhipuAI, Qwen, OpenAI, Google Gemini, Anthropic, xAI (Grok), Moonshot (Kimi)
"""

import time
from typing import Dict, List, Any, Optional


PROVIDERS = {
    "zhipuai": {
        "models": ["glm-5", "glm-4.7", "glm-4.7-flashx", "glm-4.7-flash", "custom"],
        "displayNames": {
            "glm-5": "GLM-5",
            "glm-4.7": "GLM-4.7",
            "glm-4.7-flashx": "GLM-4.7-FlashX",
            "glm-4.7-flash": "GLM-4.7-Flash (Free)",
            "custom": "+ Custom Model",
        },
        "label": "ZhipuAI (Z.AI)",
        "docsUrl": "https://bigmodel.cn/dev/api/normal-model/glm-4",
        "apiKeyName": "zhipuaiApiKey",
    },
    "qwen": {
        "models": [
            "qwen3.5-plus", "qwen3.5-flash", "qwen3.6-plus",
            "qwen3.6-plus-2026-04-02", "qwen3.5-122b-a10b",
            "qwen3.5-plus-2026-02-15", "qwen3.5-flash-2026-02-23",
            "deepseek-v3.2", "custom",
        ],
        "displayNames": {
            "qwen3.5-plus": "Qwen3.5-Plus",
            "qwen3.5-flash": "Qwen3.5-Flash",
            "qwen3.6-plus": "Qwen3.6-Plus",
            "qwen3.6-plus-2026-04-02": "Qwen3.6-Plus (2026-04-02)",
            "qwen3.5-122b-a10b": "Qwen3.5-122B-A10B",
            "qwen3.5-plus-2026-02-15": "Qwen3.5-Plus (2026-02-15)",
            "qwen3.5-flash-2026-02-23": "Qwen3.5-Flash (2026-02-23)",
            "deepseek-v3.2": "DeepSeek V3.2 (via Qwen)",
            "custom": "+ Custom Model",
        },
        "baseUrl": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "label": "Alibaba Cloud (Qwen/DS)",
        "docsUrl": "https://www.alibabacloud.com/help/en/model-studio/getting-started/models",
        "apiKeyName": "qwenApiKey",
    },
    "openai": {
        "models": ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5.4-pro", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "custom"],
        "displayNames": {
            "gpt-5.4": "GPT-5.4",
            "gpt-5.4-mini": "GPT-5.4-mini",
            "gpt-5.4-nano": "GPT-5.4-nano",
            "gpt-5.4-pro": "GPT-5.4-pro",
            "gpt-4.1": "GPT-4.1",
            "gpt-4.1-mini": "GPT-4.1-mini",
            "gpt-4o": "GPT-4o",
            "gpt-4o-mini": "GPT-4o-mini",
            "custom": "+ Custom Model",
        },
        "label": "OpenAI",
        "docsUrl": "https://platform.openai.com/docs/models",
        "apiKeyName": "openaiApiKey",
    },
    "gemini": {
        "models": ["gemini-3.1-pro-preview", "gemini-3.1-flash-lite-preview", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "custom"],
        "displayNames": {
            "gemini-3.1-pro-preview": "Gemini 3.1 Pro (Preview)",
            "gemini-3.1-flash-lite-preview": "Gemini 3.1 Flash Lite (Preview)",
            "gemini-3-flash-preview": "Gemini 3 Flash (Preview)",
            "gemini-2.5-pro": "Gemini 2.5 Pro",
            "gemini-2.5-flash": "Gemini 2.5 Flash",
            "gemini-2.0-flash": "Gemini 2.0 Flash",
            "custom": "+ Custom Model",
        },
        "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "label": "Google Gemini",
        "docsUrl": "https://ai.google.dev/gemini-api/docs/models",
        "apiKeyName": "geminiApiKey",
    },
    "anthropic": {
        "models": ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5", "custom"],
        "displayNames": {
            "claude-opus-4-6": "Claude Opus 4.6",
            "claude-sonnet-4-6": "Claude Sonnet 4.6",
            "claude-haiku-4-5": "Claude Haiku 4.5",
            "custom": "+ Custom Model",
        },
        "label": "Anthropic (Claude)",
        "docsUrl": "https://docs.anthropic.com/en/docs/about-claude/models",
        "apiKeyName": "anthropicApiKey",
    },
    "xai": {
        "models": ["grok-4.20-0309", "grok-4.1-fast", "grok-3", "grok-3-mini", "custom"],
        "displayNames": {
            "grok-4.20-0309": "Grok 4.20 (0309)",
            "grok-4.1-fast": "Grok 4.1 Fast",
            "grok-3": "Grok 3",
            "grok-3-mini": "Grok 3 Mini",
            "custom": "+ Custom Model",
        },
        "baseUrl": "https://api.x.ai/v1",
        "label": "xAI (Grok)",
        "docsUrl": "https://docs.x.ai/docs/models",
        "apiKeyName": "xaiApiKey",
    },
    "moonshot": {
        "models": ["kimi-k2.5", "moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k", "custom"],
        "displayNames": {
            "kimi-k2.5": "Kimi K2.5",
            "moonshot-v1-128k": "Moonshot v1 128k",
            "moonshot-v1-32k": "Moonshot v1 32k",
            "moonshot-v1-8k": "Moonshot v1 8k",
            "custom": "+ Custom Model",
        },
        "baseUrl": "https://api.moonshot.cn/v1",
        "label": "Moonshot AI (Kimi)",
        "docsUrl": "https://platform.moonshot.cn/docs/api/chat",
        "apiKeyName": "moonshotApiKey",
    },
    "openaicompat": {
        "models": [],
        "displayNames": {},
        "label": "OpenAI Compatible",
        "docsUrl": "",
        "apiKeyName": "openaicompatApiKey",
    },
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
        text = response.content[0].text if response.content else ""
        self.choices = [_AnthropicResponseChoice(text)]
        self.usage = _AnthropicUsage(
            response.usage.input_tokens,
            response.usage.output_tokens,
        )


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

        self.temperature = config.get("temperature", 0.3)
        self.max_tokens = config.get("maxTokensPerIteration", 16000)
        self._client = None
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
        if p == "zhipuai":
            self._init_zhipuai(config.get("zhipuaiApiKey", ""))
        elif p == "qwen":
            self._init_openai_compat(config.get("qwenApiKey", ""), PROVIDERS["qwen"]["baseUrl"])
        elif p == "openai":
            self._init_openai_compat(config.get("openaiApiKey", ""), None)
        elif p == "gemini":
            self._init_openai_compat(config.get("geminiApiKey", ""), PROVIDERS["gemini"]["baseUrl"])
        elif p == "anthropic":
            self._init_anthropic(config.get("anthropicApiKey", ""))
        elif p == "xai":
            self._init_openai_compat(config.get("xaiApiKey", ""), PROVIDERS["xai"]["baseUrl"])
        elif p == "moonshot":
            self._init_openai_compat(config.get("moonshotApiKey", ""), PROVIDERS["moonshot"]["baseUrl"])
        elif p == "openaicompat":
            self._init_openai_compat(
                config.get("openaicompatApiKey", ""),
                config.get("openaicompatBaseUrl", "") or None,
                default_headers=self._build_openaicompat_headers(config),
                optimize_stream=True,
            )
        else:
            raise ValueError(f"Unknown provider: {p}")

    def _init_zhipuai(self, api_key: str):
        if not api_key:
            raise ValueError("ZhipuAI API key is required")
        from zai import ZaiClient
        self._client = ZaiClient(api_key=api_key)
        self._client_type = "zhipuai"

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
                print("[OpenAICompat] HTTP/2 disabled (package 'h2' not installed), using HTTP/1.1")
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
            print(
                "[OpenAICompat] Stream tuning enabled | default headers: "
                + ", ".join(default_headers.keys())
            )

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

        print(f"[API →] {self.provider} / {model_display} | {mode_label} | "
              f"max_tokens={mt} | temp={temp} | "
              f"msgs={len(messages)} | ~{input_tokens_est} tok input")

        t0 = time.time()

        if self._client_type == "zhipuai":
            result = self._complete_zhipuai(messages, stream, mt, temp)
        elif self._client_type == "openai":
            result = self._complete_openai(messages, stream, mt, temp)
        elif self._client_type == "anthropic":
            result = self._complete_anthropic(messages, stream, mt, temp)
        else:
            raise ValueError(f"Unknown client type: {self._client_type}")

        if not stream:
            elapsed = time.time() - t0
            try:
                usage = result.usage
                print(f"[API ←] done in {elapsed:.1f}s | "
                      f"in={usage.prompt_tokens} out={usage.completion_tokens} "
                      f"total={usage.total_tokens} tok")
            except Exception:
                print(f"[API ←] done in {elapsed:.1f}s")

        return result

    def _complete_zhipuai(self, messages, stream, max_tokens, temperature):
        return self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
        )

    def _complete_openai(self, messages, stream, max_tokens, temperature):
        return self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
        )

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
            temperature=temperature,
            messages=user_messages,
        )
        if system_msg:
            kwargs["system"] = system_msg

        if stream:
            stream_ctx = self._client.messages.stream(**kwargs)
            return _anthropic_stream_generator(stream_ctx)
        else:
            response = self._client.messages.create(**kwargs)
            return _AnthropicResponse(response)

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
        if self.provider != old_provider or self.provider == "openaicompat":
            self._init_provider(config)


def test_client(config: Dict[str, Any]) -> Dict[str, Any]:
    """Test if client can be initialized and make a simple API call."""
    try:
        client = LLMClient(config)
        messages = [{"role": "user", "content": "Hello! Please respond with 'OK'."}]
        # Always stream to avoid thinking-token budget issues
        stream = client.complete(messages, stream=True, max_tokens=20)
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
