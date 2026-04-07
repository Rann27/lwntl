"""
Extractor Module - Glossary Extraction
Implements glossary extraction pass per Section 8.6
"""

import json
from typing import Dict, Any, List
from .llm_client import LLMClient
from .prompt_builder import build_extraction_prompt


def _collect_streamed_content(stream) -> str:
    """
    Collect only delta.content from a streaming response.
    Explicitly ignores delta.reasoning_content (thinking tokens from GLM-4.7 etc.)
    so that deep-thinking models never exhaust the token budget before answering.
    """
    text = ""
    try:
        for chunk in stream:
            if not (hasattr(chunk, 'choices') and chunk.choices):
                continue
            delta = chunk.choices[0].delta
            # Only collect actual content, skip reasoning/thinking tokens
            if hasattr(delta, 'content') and delta.content:
                text += delta.content
    except Exception as e:
        print(f"[Extractor] Stream collection error: {e}")
    return text


def extract_glossary_terms(
    llm_client: LLMClient,
    raw_content: str,
    translated_content: str
) -> Dict[str, Any]:
    """
    Extract glossary terms from original and translated content

    Args:
        llm_client: LLMClient instance
        raw_content: Original text content
        translated_content: Translated text content

    Returns:
        dict: {
            "extractedAt": ISO timestamp,
            "entries": List of {id, sourceTerm, translatedTerm, notes}
        }
    """
    try:
        # Build extraction prompt
        messages = build_extraction_prompt(raw_content, translated_content)

        # Use stream=True so thinking tokens (reasoning_content) don't fill the budget.
        # We collect only delta.content chunks — the actual answer after thinking.
        stream = llm_client.complete(messages, stream=True, max_tokens=4000)
        content = _collect_streamed_content(stream)

        if not content or not content.strip():
            print("[Extractor] Empty response from LLM")
            from datetime import datetime
            now = datetime.utcnow().isoformat() + 'Z'
            return {"extractedAt": now, "entries": [], "error": "Empty LLM response"}

        # Try to parse JSON
        try:
            # Remove markdown code fences if present
            cleaned = content.strip()
            if cleaned.startswith('```'):
                lines = cleaned.split('\n')
                lines = [l for l in lines if not l.strip().startswith('```')]
                cleaned = '\n'.join(lines)

            # Extract JSON array from response (in case there's extra text)
            if '[' in cleaned and ']' in cleaned:
                start = cleaned.index('[')
                end = cleaned.rindex(']') + 1
                json_str = cleaned[start:end]
                extracted_entries = json.loads(json_str)
            else:
                extracted_entries = json.loads(cleaned)

            # Convert to our format
            entries = []
            for i, entry in enumerate(extracted_entries):
                entries.append({
                    "id": f"extracted-{i}",
                    "sourceTerm": entry.get("sourceTerm", ""),
                    "translatedTerm": entry.get("translatedTerm", ""),
                    "notes": entry.get("notes", ""),
                    "isExtracted": True,
                })

            from datetime import datetime
            now = datetime.utcnow().isoformat() + 'Z'
            return {"extractedAt": now, "entries": entries}

        except json.JSONDecodeError as e:
            print(f"[Extractor] Failed to parse JSON: {e}")
            print(f"[Extractor] Raw content: {content[:200]}")
            from datetime import datetime
            now = datetime.utcnow().isoformat() + 'Z'
            return {
                "extractedAt": now,
                "entries": [],
                "error": "Failed to parse extraction response"
            }
            
    except Exception as e:
        print(f"Extraction error: {e}")
        
        from datetime import datetime
        now = datetime.utcnow().isoformat() + 'Z'
        
        return {
            "extractedAt": now,
            "entries": [],
            "error": str(e)
        }


def merge_glossary_updates(
    current_glossary: List[Dict[str, Any]],
    extracted_entries: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Merge extracted glossary entries with current glossary
    
    Args:
        current_glossary: Existing glossary entries
        extracted_entries: Newly extracted entries
        
    Returns:
        list: Merged glossary with duplicates resolved
    """
    if not extracted_entries:
        return current_glossary
    
    merged = current_glossary.copy()
    
    for extracted in extracted_entries:
        source_term = extracted.get("sourceTerm", "").lower().strip()
        translated_term = extracted.get("translatedTerm", "")
        notes = extracted.get("notes", "")
        
        # Check if term already exists
        found = False
        for entry in merged:
            existing_source = entry.get("sourceTerm", "").lower().strip()
            
            if existing_source == source_term:
                # Term exists, potentially update
                # Keep the existing entry if translation matches
                # Otherwise, keep the extracted one
                if entry.get("translatedTerm", "") != translated_term:
                    # Different translation, add as new entry with updated notes
                    pass  # Keep existing for now
                found = True
                break
        
        if not found:
            # New term, add it
            merged.append({
                "id": extracted.get("id", f"merged-{len(merged)}"),
                "sourceTerm": extracted.get("sourceTerm", ""),
                "translatedTerm": translated_term,
                "notes": notes,
                "isExtracted": True
            })
    
    return merged