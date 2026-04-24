"""
Extractor Module - Glossary Extraction

Primary path:  parse_glossary_from_translation()
  Parses the markdown glossary table that models naturally write at the end of
  the translation output when the system prompt instructs them to.  Zero extra
  API calls; uses the same output that is already being streamed.

Fallback path: extract_glossary_terms()
  Sends a separate LLM call.  Used only when the primary parse returns nothing
  (e.g. the user has a custom system prompt that does not request a table).
"""

import re
import json
from datetime import datetime
from typing import Dict, Any, List
from .llm_client import LLMClient
from .prompt_builder import build_extraction_prompt


def strip_glossary_table(content: str) -> str:
    """
    Remove the trailing glossary table (and its optional '---' separator +
    bold heading) from translated content, leaving only the pure translation.

    Mirrors the two-strategy detection used by parse_glossary_from_translation:
    1. Find the last '---' that is followed by a markdown table → strip from there.
    2. Otherwise, strip the last pipe-delimited table block + any blank lines /
       bold heading immediately above it.
    """
    if not content:
        return content

    lines = content.split('\n')

    # Strategy 1 — last '---' before a table
    for i in range(len(lines) - 1, -1, -1):
        if re.match(r'^-{3,}\s*$', lines[i].strip()):
            after = lines[i + 1:]
            if any(l.strip().startswith('|') and l.strip().endswith('|') for l in after):
                return '\n'.join(lines[:i]).rstrip()

    # Strategy 2 — last table block at the end of the content
    end = len(lines) - 1
    while end >= 0 and not lines[end].strip():
        end -= 1

    if end >= 0:
        s = lines[end].strip()
        if s.startswith('|') and s.endswith('|'):
            start = end
            while start > 0:
                prev = lines[start - 1].strip()
                if prev.startswith('|') and prev.endswith('|'):
                    start -= 1
                else:
                    break

            # Also remove the optional bold heading + blank lines above the table
            strip_from = start
            for i in range(start - 1, max(-1, start - 5), -1):
                t = lines[i].strip()
                if not t or re.match(r'^\*\*[^*]+\*\*[:\s]*$', t):
                    strip_from = i
                else:
                    break

            return '\n'.join(lines[:strip_from]).rstrip()

    return content


def parse_glossary_from_translation(translated_content: str) -> Dict[str, Any]:
    """
    Parse a markdown glossary table that the model appends to the translation.

    Strategy (robust, model-agnostic):
    1. Collect every markdown table block in the content.
    2. If a '---' horizontal rule exists, restrict candidates to tables that
       appear after the last '---' — this avoids picking up in-story tables.
    3. Among the candidates, prefer a table whose header contains glossary
       keywords ('source', 'term', 'glosarium', etc.). Otherwise, fall back to
       the last table found.

    This works regardless of whether the model outputs '---' before the table,
    uses a bold heading, or just appends the table directly.
    """
    now = datetime.utcnow().isoformat() + "Z"
    empty = {"extractedAt": now, "entries": []}

    if not translated_content:
        return empty

    # ── Step 1: collect all markdown table blocks ─────────────────────────────
    # A table block is a consecutive group of lines that start and end with '|'.
    lines = translated_content.split('\n')
    table_blocks: List[List[str]] = []  # list of (start_line_index, [rows])
    table_starts: List[int] = []
    current: List[str] = []
    current_start = 0

    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('|') and stripped.endswith('|') and len(stripped) > 1:
            if not current:
                current_start = idx
            current.append(stripped)
        else:
            if current:
                table_blocks.append(current)
                table_starts.append(current_start)
                current = []
    if current:
        table_blocks.append(current)
        table_starts.append(current_start)

    if not table_blocks:
        return empty

    # ── Step 2: narrow candidates to tables after the last '---' ─────────────
    last_hr_line = -1
    for idx, line in enumerate(lines):
        if re.match(r'^-{3,}\s*$', line.strip()):
            last_hr_line = idx

    if last_hr_line >= 0:
        candidates = [
            (blk, start)
            for blk, start in zip(table_blocks, table_starts)
            if start > last_hr_line
        ]
    else:
        candidates = list(zip(table_blocks, table_starts))

    if not candidates:
        # No table after '---' — fall back to all tables
        candidates = list(zip(table_blocks, table_starts))

    # ── Step 3: prefer a table with a glossary-related header ────────────────
    glossary_keywords = re.compile(
        r'source|term|glosarium|glossary|glossar|sumber|istilah|词汇|용어|어휘',
        re.IGNORECASE,
    )
    chosen_block: List[str] = candidates[-1][0]  # default: last candidate

    for blk, _ in candidates:
        if blk and glossary_keywords.search(blk[0]):
            chosen_block = blk
            break

    # ── Step 4: parse the chosen table block ─────────────────────────────────
    entries: List[Dict[str, Any]] = []
    header_skipped = False

    for row in chosen_block:
        # Strip the outer '|' then split
        inner = row.strip()
        if inner.startswith('|'):
            inner = inner[1:]
        if inner.endswith('|'):
            inner = inner[:-1]
        cells = [c.strip() for c in inner.split('|')]

        # Skip separator rows (---|---|---)
        if cells and all(re.match(r'^[-:\s]+$', c) for c in cells if c):
            continue

        # Skip header row (first non-separator row)
        if not header_skipped:
            header_skipped = True
            continue

        if len(cells) < 2:
            continue

        source = cells[0].strip()
        translated = cells[1].strip()
        notes = cells[2].strip() if len(cells) > 2 else ""

        if source and translated:
            entries.append({
                "id": f"parsed-{len(entries)}",
                "sourceTerm": source,
                "translatedTerm": translated,
                "notes": notes,
                "isExtracted": True,
            })

    if entries:
        print(f"[Extractor] Parsed {len(entries)} term(s) from translation table (no extra API call)")

    return {"extractedAt": now, "entries": entries}


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