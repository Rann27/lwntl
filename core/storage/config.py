"""
Config Management
Handles config.json in the application data directory
"""

import json
import os
from pathlib import Path
from typing import Dict, Any


def get_app_data_dir() -> Path:
    """Get the application data directory based on OS"""
    if os.name == 'nt':  # Windows
        app_data = os.environ.get('APPDATA', os.path.expanduser('~'))
        return Path(app_data) / 'lwntl'
    elif os.name == 'posix':
        if 'darwin' in os.uname().sysname:  # macOS
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
    "zhipuaiApiKey": "",
    "qwenApiKey": "",
    "temperature": 0.3,
    "maxTokensPerIteration": 16000,
    "theme": "light",
    "sourceLanguages": ["Japanese", "Chinese", "Korean"],
    "targetLanguages": ["Indonesian", "English"],
}


def get_config() -> Dict[str, Any]:
    """
    Read config.json
    
    Returns:
        dict: Configuration data
        
    Raises:
        FileNotFoundError: If config file doesn't exist
        json.JSONDecodeError: If config file is invalid JSON
    """
    config_path = get_config_path()
    
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found at {config_path}")
    
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)


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
        json.dump(config, f, indent=2, ensure_ascii=False)
    
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
        
        return DEFAULT_CONFIG
    
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