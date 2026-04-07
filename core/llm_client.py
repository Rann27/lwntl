"""
LLM Client - Unified ZhipuAI + Qwen Support
Implements multi-provider AI system per Section 8 of LWNTL-SPEC.md
"""

import time
from zai import ZaiClient
from openai import OpenAI
from typing import Dict, List, Any, Optional


PROVIDERS = {
    "zhipuai": {
        "models": ["glm-5", "glm-4.7", "glm-4.7-flashx", "glm-4.7-flash"],
        "displayNames": {
            "glm-5": "GLM-5",
            "glm-4.7": "GLM-4.7",
            "glm-4.7-flashx": "GLM-4.7-FlashX",
            "glm-4.7-flash": "GLM-4.7-Flash (Free)",
        }
    },
    "qwen": {
        "models": ["qwen-plus", "qwen-flash", "qwen3.6-plus", "deepseek-v3"],
        "displayNames": {
            "qwen-plus": "Qwen3.5-Plus",
            "qwen-flash": "Qwen3.5-Flash",
            "qwen3.6-plus": "Qwen3.6-Plus",
            "deepseek-v3": "DeepSeek V3.2",
        },
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
}


def get_provider_models(provider: str) -> List[str]:
    """Get list of available models for a provider"""
    return PROVIDERS.get(provider, {}).get("models", [])


def get_model_display_name(provider: str, model: str) -> str:
    """Get display name for a model"""
    provider_config = PROVIDERS.get(provider, {})
    display_names = provider_config.get("displayNames", {})
    return display_names.get(model, model)


class LLMClient:
    """
    Unified LLM client supporting both ZhipuAI and Qwen providers
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize LLM client with configuration
        
        Args:
            config: Configuration dictionary with provider, model, api keys, etc.
        """
        self.provider = config.get("provider", "zhipuai")
        self.model = config.get("model", "glm-5")
        self.temperature = config.get("temperature", 0.3)
        self.max_tokens = config.get("maxTokensPerIteration", 16000)
        
        # Initialize the appropriate client
        if self.provider == "zhipuai":
            self._init_zhipuai(config.get("zhipuaiApiKey", ""))
        elif self.provider == "qwen":
            self._init_qwen(config.get("qwenApiKey", ""))
        else:
            raise ValueError(f"Unknown provider: {self.provider}")
    
    def _init_zhipuai(self, api_key: str):
        """Initialize ZhipuAI client"""
        if not api_key:
            raise ValueError("ZhipuAI API key is required")
        self._client = ZaiClient(api_key=api_key)
    
    def _init_qwen(self, api_key: str):
        """Initialize Qwen client (OpenAI-compatible)"""
        if not api_key:
            raise ValueError("Qwen API key is required")
        
        provider_config = PROVIDERS.get("qwen", {})
        base_url = provider_config.get("baseUrl")
        
        self._client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
    
    def complete(
        self,
        messages: List[Dict[str, str]],
        stream: bool = True,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None
    ):
        """
        Complete a chat completion
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            stream: Whether to stream the response
            max_tokens: Override default max tokens
            temperature: Override default temperature
            
        Returns:
            Stream or completion object depending on stream parameter
            
        Raises:
            ValueError: If API key is missing or invalid provider
            Exception: If API call fails
        """
        mt = max_tokens or self.max_tokens
        temp = temperature or self.temperature

        # Estimate input size (rough: 4 chars ≈ 1 token for Latin)
        input_chars = sum(len(m.get("content", "")) for m in messages)
        input_tokens_est = input_chars // 4
        mode_label = "stream" if stream else "sync"
        model_display = get_model_display_name(self.provider, self.model)

        print(f"[API →] {self.provider} / {model_display} | {mode_label} | "
              f"max_tokens={mt} | temp={temp} | "
              f"msgs={len(messages)} | ~{input_tokens_est} tok input")

        t0 = time.time()

        if self.provider == "zhipuai":
            result = self._complete_zhipuai(messages, stream, mt, temp)
        elif self.provider == "qwen":
            result = self._complete_qwen(messages, stream, mt, temp)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

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
    
    def _complete_zhipuai(
        self,
        messages: List[Dict[str, str]],
        stream: bool,
        max_tokens: int,
        temperature: float
    ):
        """Complete using ZhipuAI (zai-sdk)"""
        return self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream
        )
    
    def _complete_qwen(
        self,
        messages: List[Dict[str, str]],
        stream: bool,
        max_tokens: int,
        temperature: float
    ):
        """Complete using Qwen (OpenAI-compatible)"""
        return self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream
        )
    
    def update_config(self, config: Dict[str, Any]):
        """
        Update client configuration
        
        Args:
            config: New configuration dictionary
            
        Raises:
            ValueError: If provider changed and requires reinitialization
        """
        old_provider = self.provider
        
        self.provider = config.get("provider", old_provider)
        self.model = config.get("model", self.model)
        self.temperature = config.get("temperature", self.temperature)
        self.max_tokens = config.get("maxTokensPerIteration", self.max_tokens)
        
        # Reinitialize client if provider changed
        if self.provider != old_provider:
            if self.provider == "zhipuai":
                self._init_zhipuai(config.get("zhipuaiApiKey", ""))
            elif self.provider == "qwen":
                self._init_qwen(config.get("qwenApiKey", ""))


def test_client(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Test if client can be initialized and make a simple API call
    
    Args:
        config: Configuration dictionary
        
    Returns:
        dict: {"success": bool, "message": str, "error": Optional[str]}
    """
    try:
        client = LLMClient(config)
        
        # Simple test message
        messages = [
            {"role": "user", "content": "Hello! Please respond with 'OK' if you receive this."}
        ]
        
        response = client.complete(messages, stream=False, max_tokens=10)
        
        if response and hasattr(response, 'choices') and len(response.choices) > 0:
            content = response.choices[0].message.content
            return {
                "success": True,
                "message": "Connection successful",
                "response": content
            }
        else:
            return {
                "success": False,
                "message": "Unexpected response format",
                "error": "No choices in response"
            }
            
    except ValueError as e:
        return {
            "success": False,
            "message": "Configuration error",
            "error": str(e)
        }
    except Exception as e:
        return {
            "success": False,
            "message": "API call failed",
            "error": str(e)
        }