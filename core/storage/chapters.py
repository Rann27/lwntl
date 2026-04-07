"""
Chapter Management
Handles chapter.json CRUD operations and cascade delete
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


def get_chapters_dir(series_id: str) -> Path:
    """Get the chapters directory for a series"""
    return get_series_dir() / series_id / 'chapters'


def get_chapter_path(series_id: str, chapter_id: str) -> Path:
    """Get the path to a chapter.json file"""
    return get_chapters_dir(series_id) / chapter_id / 'chapter.json'


def get_chapters(series_id: str) -> List[Dict[str, Any]]:
    """
    Get all chapters for a series
    
    Args:
        series_id: Series UUID
        
    Returns:
        list: List of all chapter dictionaries sorted by chapter number
        
    Raises:
        json.JSONDecodeError: If any chapter.json is invalid
        OSError: If unable to read files
    """
    chapters_dir = get_chapters_dir(series_id)
    
    if not chapters_dir.exists():
        return []
    
    chapter_list = []
    
    for chapter_path in chapters_dir.iterdir():
        if not chapter_path.is_dir():
            continue
        
        chapter_json = chapter_path / 'chapter.json'
        
        if chapter_json.exists():
            try:
                with open(chapter_json, 'r', encoding='utf-8') as f:
                    chapter = json.load(f)
                    chapter_list.append(chapter)
            except (json.JSONDecodeError, OSError) as e:
                print(f"Error reading chapter {chapter_path.name}: {e}")
                continue
    
    # Sort by chapter number
    chapter_list.sort(key=lambda c: c.get('chapterNumber', 0))
    
    return chapter_list


def create_chapter(series_id: str, number: int, title: str, raw_content: str) -> Dict[str, Any]:
    """
    Create a new chapter
    
    Args:
        series_id: Series UUID
        number: Chapter number
        title: Chapter title
        raw_content: Raw text content
        
    Returns:
        dict: The created chapter data
        
    Raises:
        OSError: If unable to create directories or write file
    """
    chapter_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + 'Z'
    
    chapter = {
        "id": chapter_id,
        "seriesId": series_id,
        "chapterNumber": number,
        "title": title,
        "rawContent": raw_content,
        "translatedContent": "",
        "summary": "",
        "status": "pending",
        "glossaryUpdates": {
            "extractedAt": None,
            "entries": []
        },
        "translationLog": {
            "iterations": 0,
            "totalTokens": 0,
            "translatedAt": None
        },
        "createdAt": now,
        "updatedAt": now
    }
    
    # Create chapter directory
    chapter_dir = get_chapters_dir(series_id) / chapter_id
    chapter_dir.mkdir(parents=True, exist_ok=True)
    
    # Write chapter.json
    chapter_json = chapter_dir / 'chapter.json'
    with open(chapter_json, 'w', encoding='utf-8') as f:
        json.dump(chapter, f, indent=2, ensure_ascii=False)
    
    return chapter


def get_chapter(series_id: str, chapter_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific chapter by ID
    
    Args:
        series_id: Series UUID
        chapter_id: Chapter UUID
        
    Returns:
        dict: Chapter data or None if not found
        
    Raises:
        json.JSONDecodeError: If chapter.json is invalid
    """
    chapter_path = get_chapter_path(series_id, chapter_id)
    
    if not chapter_path.exists():
        return None
    
    with open(chapter_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def update_chapter(series_id: str, chapter_id: str, number: int, title: str, raw_content: str) -> Dict[str, Any]:
    """
    Update a chapter
    
    Args:
        series_id: Series UUID
        chapter_id: Chapter UUID
        number: New chapter number
        title: New title
        raw_content: New raw content
        
    Returns:
        dict: Updated chapter data
        
    Raises:
        FileNotFoundError: If chapter doesn't exist
        json.JSONDecodeError: If chapter.json is invalid
    """
    chapter = get_chapter(series_id, chapter_id)
    
    if chapter is None:
        raise FileNotFoundError(f"Chapter {chapter_id} not found in series {series_id}")
    
    chapter["chapterNumber"] = number
    chapter["title"] = title
    chapter["rawContent"] = raw_content
    chapter["updatedAt"] = datetime.utcnow().isoformat() + 'Z'
    
    # Write updated chapter.json
    chapter_path = get_chapter_path(series_id, chapter_id)
    with open(chapter_path, 'w', encoding='utf-8') as f:
        json.dump(chapter, f, indent=2, ensure_ascii=False)
    
    return chapter


def get_chapter_delete_info(series_id: str, chapter_id: str) -> Dict[str, Any]:
    """
    Get information about what will be deleted
    
    Args:
        series_id: Series UUID
        chapter_id: Chapter UUID
        
    Returns:
        dict: Information about the chapter to be deleted
    """
    chapter = get_chapter(series_id, chapter_id)
    
    if chapter is None:
        raise FileNotFoundError(f"Chapter {chapter_id} not found in series {series_id}")
    
    return {
        "chapterNumber": chapter.get("chapterNumber"),
        "title": chapter.get("title", ""),
        "status": chapter.get("status")
    }


def delete_chapter(series_id: str, chapter_id: str) -> bool:
    """
    Delete a chapter (cascade delete: removes chapter folder)
    
    Args:
        series_id: Series UUID
        chapter_id: Chapter UUID
        
    Returns:
        bool: True if successful
        
    Raises:
        FileNotFoundError: If chapter doesn't exist
        OSError: If unable to delete directory
    """
    chapter_dir = get_chapters_dir(series_id) / chapter_id
    
    if not chapter_dir.exists():
        raise FileNotFoundError(f"Chapter {chapter_id} not found in series {series_id}")
    
    # Delete entire chapter directory
    shutil.rmtree(chapter_dir)
    
    return True


def update_chapter_status(series_id: str, chapter_id: str, status: str) -> Dict[str, Any]:
    """
    Update chapter status (pending/processing/done/error)
    
    Args:
        series_id: Series UUID
        chapter_id: Chapter UUID
        status: New status (pending/processing/done/error)
        
    Returns:
        dict: Updated chapter data
        
    Raises:
        FileNotFoundError: If chapter doesn't exist
    """
    chapter = get_chapter(series_id, chapter_id)
    
    if chapter is None:
        raise FileNotFoundError(f"Chapter {chapter_id} not found in series {series_id}")
    
    chapter["status"] = status
    chapter["updatedAt"] = datetime.utcnow().isoformat() + 'Z'
    
    # If status is done, update translation log
    if status == "done":
        chapter["translationLog"]["translatedAt"] = chapter["updatedAt"]
    
    # Write updated chapter.json
    chapter_path = get_chapter_path(series_id, chapter_id)
    with open(chapter_path, 'w', encoding='utf-8') as f:
        json.dump(chapter, f, indent=2, ensure_ascii=False)
    
    return chapter


def update_chapter_translation(series_id: str, chapter_id: str, translated_content: str) -> Dict[str, Any]:
    """
    Update chapter translation result
    
    Args:
        series_id: Series UUID
        chapter_id: Chapter UUID
        translated_content: Translated Markdown content
        
    Returns:
        dict: Updated chapter data
        
    Raises:
        FileNotFoundError: If chapter doesn't exist
    """
    chapter = get_chapter(series_id, chapter_id)
    
    if chapter is None:
        raise FileNotFoundError(f"Chapter {chapter_id} not found in series {series_id}")
    
    chapter["translatedContent"] = translated_content
    chapter["updatedAt"] = datetime.utcnow().isoformat() + 'Z'
    
    # Write updated chapter.json
    chapter_path = get_chapter_path(series_id, chapter_id)
    with open(chapter_path, 'w', encoding='utf-8') as f:
        json.dump(chapter, f, indent=2, ensure_ascii=False)
    
    return chapter


def update_chapter_summary(series_id: str, chapter_id: str, summary: str) -> Dict[str, Any]:
    """
    Update chapter summary
    
    Args:
        series_id: Series UUID
        chapter_id: Chapter UUID
        summary: Chapter summary text
        
    Returns:
        dict: Updated chapter data
        
    Raises:
        FileNotFoundError: If chapter doesn't exist
    """
    chapter = get_chapter(series_id, chapter_id)
    
    if chapter is None:
        raise FileNotFoundError(f"Chapter {chapter_id} not found in series {series_id}")
    
    chapter["summary"] = summary
    chapter["updatedAt"] = datetime.utcnow().isoformat() + 'Z'
    
    # Write updated chapter.json
    chapter_path = get_chapter_path(series_id, chapter_id)
    with open(chapter_path, 'w', encoding='utf-8') as f:
        json.dump(chapter, f, indent=2, ensure_ascii=False)
    
    return chapter


def update_glossary_updates(series_id: str, chapter_id: str, glossary_updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update glossary updates for a chapter
    
    Args:
        series_id: Series UUID
        chapter_id: Chapter UUID
        glossary_updates: Glossary updates dictionary
        
    Returns:
        dict: Updated chapter data
        
    Raises:
        FileNotFoundError: If chapter doesn't exist
    """
    chapter = get_chapter(series_id, chapter_id)
    
    if chapter is None:
        raise FileNotFoundError(f"Chapter {chapter_id} not found in series {series_id}")
    
    chapter["glossaryUpdates"] = glossary_updates
    chapter["updatedAt"] = datetime.utcnow().isoformat() + 'Z'
    
    # Write updated chapter.json
    chapter_path = get_chapter_path(series_id, chapter_id)
    with open(chapter_path, 'w', encoding='utf-8') as f:
        json.dump(chapter, f, indent=2, ensure_ascii=False)
    
    return chapter


def update_translation_log(series_id: str, chapter_id: str, iterations: int, total_tokens: int) -> Dict[str, Any]:
    """
    Update translation log for a chapter
    
    Args:
        series_id: Series UUID
        chapter_id: Chapter UUID
        iterations: Number of translation iterations
        total_tokens: Total tokens used
        
    Returns:
        dict: Updated chapter data
        
    Raises:
        FileNotFoundError: If chapter doesn't exist
    """
    chapter = get_chapter(series_id, chapter_id)
    
    if chapter is None:
        raise FileNotFoundError(f"Chapter {chapter_id} not found in series {series_id}")
    
    chapter["translationLog"]["iterations"] = iterations
    chapter["translationLog"]["totalTokens"] = total_tokens
    chapter["updatedAt"] = datetime.utcnow().isoformat() + 'Z'
    
    # Write updated chapter.json
    chapter_path = get_chapter_path(series_id, chapter_id)
    with open(chapter_path, 'w', encoding='utf-8') as f:
        json.dump(chapter, f, indent=2, ensure_ascii=False)
    
    return chapter