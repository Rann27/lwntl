"""
Series Management
Handles series.json CRUD operations and cascade delete
"""

import json
import shutil
import uuid
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from .config import get_app_data_dir


def get_series_dir() -> Path:
    """Get the series directory path"""
    return get_app_data_dir() / 'series'


def get_series_path(series_id: str) -> Path:
    """Get the path to a series.json file"""
    return get_series_dir() / series_id / 'series.json'


def get_all_series() -> List[Dict[str, Any]]:
    """
    Get all series
    
    Returns:
        list: List of all series dictionaries
        
    Raises:
        json.JSONDecodeError: If any series.json is invalid
        OSError: If unable to read files
    """
    series_dir = get_series_dir()
    
    if not series_dir.exists():
        return []
    
    series_list = []
    
    for series_path in series_dir.iterdir():
        if not series_path.is_dir():
            continue
        
        series_json = series_path / 'series.json'
        
        if series_json.exists():
            try:
                with open(series_json, 'r', encoding='utf-8') as f:
                    series = json.load(f)
                    series_list.append(series)
            except (json.JSONDecodeError, OSError) as e:
                print(f"Error reading series {series_path.name}: {e}")
                continue
    
    return series_list


def create_series(title: str, language: str, target_language: str = "Indonesian") -> Dict[str, Any]:
    """
    Create a new series
    
    Args:
        title: Series title
        language: Source language
        target_language: Target language for translation
        
    Returns:
        dict: The created series data
        
    Raises:
        OSError: If unable to create directories or write file
    """
    series_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + 'Z'
    
    series = {
        "id": series_id,
        "title": title,
        "sourceLanguage": language,
        "targetLanguage": target_language,
        "systemPrompt": "",
        "instructions": "",
        "glossary": [],
        "memory": [],
        "createdAt": now,
        "updatedAt": now
    }
    
    # Create series directory
    series_path = get_series_dir() / series_id
    series_path.mkdir(parents=True, exist_ok=True)
    
    # Create chapters directory
    chapters_path = series_path / 'chapters'
    chapters_path.mkdir(exist_ok=True)
    
    # Write series.json
    series_json = series_path / 'series.json'
    with open(series_json, 'w', encoding='utf-8') as f:
        json.dump(series, f, indent=2, ensure_ascii=False)
    
    return series


def get_series(series_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific series by ID
    
    Args:
        series_id: Series UUID
        
    Returns:
        dict: Series data or None if not found
        
    Raises:
        json.JSONDecodeError: If series.json is invalid
    """
    series_path = get_series_path(series_id)
    
    if not series_path.exists():
        return None
    
    with open(series_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def update_series(series_id: str, title: str, language: str, 
                  target_language: str = None, system_prompt: str = None) -> Dict[str, Any]:
    """
    Update a series
    
    Args:
        series_id: Series UUID
        title: New title
        language: New source language
        target_language: Target language (optional)
        system_prompt: System prompt override (optional)
        
    Returns:
        dict: Updated series data
    """
    series = get_series(series_id)
    
    if series is None:
        raise FileNotFoundError(f"Series {series_id} not found")
    
    series["title"] = title
    series["sourceLanguage"] = language
    if target_language is not None:
        series["targetLanguage"] = target_language
    if system_prompt is not None:
        series["systemPrompt"] = system_prompt
    series["updatedAt"] = datetime.utcnow().isoformat() + 'Z'
    
    # Write updated series.json
    series_path = get_series_path(series_id)
    with open(series_path, 'w', encoding='utf-8') as f:
        json.dump(series, f, indent=2, ensure_ascii=False)
    
    return series


def get_series_delete_info(series_id: str) -> Dict[str, Any]:
    """
    Get information about what will be deleted
    
    Args:
        series_id: Series UUID
        
    Returns:
        dict: { "chapterCount": int }
        
    Raises:
        FileNotFoundError: If series doesn't exist
    """
    from .chapters import get_chapters
    
    chapters = get_chapters(series_id)
    return {
        "chapterCount": len(chapters)
    }


def delete_series(series_id: str) -> bool:
    """
    Delete a series (cascade delete: removes all chapters and series data)
    
    Args:
        series_id: Series UUID
        
    Returns:
        bool: True if successful
        
    Raises:
        FileNotFoundError: If series doesn't exist
        OSError: If unable to delete files/directories
    """
    series_path = get_series_dir() / series_id
    
    if not series_path.exists():
        raise FileNotFoundError(f"Series {series_id} not found")
    
    # Delete entire series directory (cascade delete)
    shutil.rmtree(series_path)
    
    return True


def save_instructions(series_id: str, instructions: str) -> bool:
    """
    Update series instructions
    
    Args:
        series_id: Series UUID
        instructions: New instructions text
        
    Returns:
        bool: True if successful
        
    Raises:
        FileNotFoundError: If series doesn't exist
    """
    series = get_series(series_id)
    
    if series is None:
        raise FileNotFoundError(f"Series {series_id} not found")
    
    series["instructions"] = instructions
    series["updatedAt"] = datetime.utcnow().isoformat() + 'Z'
    
    # Write updated series.json
    series_path = get_series_path(series_id)
    with open(series_path, 'w', encoding='utf-8') as f:
        json.dump(series, f, indent=2, ensure_ascii=False)
    
    return True


def add_glossary_entry(series_id: str, source_term: str, translated_term: str, notes: str) -> Dict[str, Any]:
    """
    Add a glossary entry to a series
    
    Args:
        series_id: Series UUID
        source_term: Original term (kanji/hanzi/hangul)
        translated_term: Translated term
        notes: Optional notes
        
    Returns:
        dict: The created glossary entry
        
    Raises:
        FileNotFoundError: If series doesn't exist
    """
    series = get_series(series_id)
    
    if series is None:
        raise FileNotFoundError(f"Series {series_id} not found")
    
    entry_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + 'Z'
    
    entry = {
        "id": entry_id,
        "sourceTerm": source_term,
        "translatedTerm": translated_term,
        "notes": notes,
        "updatedAt": now
    }
    
    series["glossary"].append(entry)
    series["updatedAt"] = now
    
    # Write updated series.json
    series_path = get_series_path(series_id)
    with open(series_path, 'w', encoding='utf-8') as f:
        json.dump(series, f, indent=2, ensure_ascii=False)
    
    return entry


def update_glossary_entry(series_id: str, entry_id: str, source_term: str, translated_term: str, notes: str) -> Dict[str, Any]:
    """
    Update a glossary entry
    
    Args:
        series_id: Series UUID
        entry_id: Glossary entry UUID
        source_term: Updated source term
        translated_term: Updated translated term
        notes: Updated notes
        
    Returns:
        dict: The updated glossary entry
        
    Raises:
        FileNotFoundError: If series or entry doesn't exist
    """
    series = get_series(series_id)
    
    if series is None:
        raise FileNotFoundError(f"Series {series_id} not found")
    
    # Find and update the entry
    entry_found = False
    now = datetime.utcnow().isoformat() + 'Z'
    
    for entry in series["glossary"]:
        if entry["id"] == entry_id:
            entry["sourceTerm"] = source_term
            entry["translatedTerm"] = translated_term
            entry["notes"] = notes
            entry["updatedAt"] = now
            entry_found = True
            break
    
    if not entry_found:
        raise FileNotFoundError(f"Glossary entry {entry_id} not found in series {series_id}")
    
    series["updatedAt"] = now
    
    # Write updated series.json
    series_path = get_series_path(series_id)
    with open(series_path, 'w', encoding='utf-8') as f:
        json.dump(series, f, indent=2, ensure_ascii=False)
    
    return entry


def delete_glossary_entry(series_id: str, entry_id: str) -> bool:
    """
    Delete a glossary entry from a series
    
    Args:
        series_id: Series UUID
        entry_id: Glossary entry UUID
        
    Returns:
        bool: True if successful
        
    Raises:
        FileNotFoundError: If series doesn't exist
    """
    series = get_series(series_id)
    
    if series is None:
        raise FileNotFoundError(f"Series {series_id} not found")
    
    # Remove the entry
    series["glossary"] = [e for e in series["glossary"] if e["id"] != entry_id]
    series["updatedAt"] = datetime.utcnow().isoformat() + 'Z'
    
    # Write updated series.json
    series_path = get_series_path(series_id)
    with open(series_path, 'w', encoding='utf-8') as f:
        json.dump(series, f, indent=2, ensure_ascii=False)
    
    return True