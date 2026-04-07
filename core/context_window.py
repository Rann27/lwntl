"""
Context Window Manager
Manages the 128k token context window per-series with auto-compact
Implements Section 8.5 - Context Window 3-Layer
"""

import json
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime
from .storage.series import get_series, get_series_path
from .storage.chapters import get_chapters, get_chapter, update_chapter_summary
from .llm_client import LLMClient
from .prompt_builder import build_system_prompt


# Context window configuration
MAX_CONTEXT_TOKENS = 128_000          # Total context window
RESERVED_RESPONSE_TOKENS = 16_000     # Reserved for LLM response
AVAILABLE_CONTEXT_TOKENS = MAX_CONTEXT_TOKENS - RESERVED_RESPONSE_TOKENS  # 112k for input
SUMMARY_GENERATION_MAX_TOKENS = 1000  # Max tokens for summary generation
MEMORY_COMPACT_MAX_TOKENS = 2000      # Max tokens for memory compaction


def estimate_tokens(text: str) -> int:
    """
    Estimate token count for text.
    
    Uses rough heuristic:
    - CJK characters (kanji, hiragana, katakana, hangul): ~2 chars/token
    - Latin/other characters: ~4 chars/token
    
    Args:
        text: Input text
        
    Returns:
        int: Estimated token count
    """
    if not text:
        return 0
    
    cjk_count = 0
    for c in text:
        cp = ord(c)
        # CJK Unified Ideographs
        if 0x4E00 <= cp <= 0x9FFF:
            cjk_count += 1
        # Hiragana + Katakana
        elif 0x3040 <= cp <= 0x30FF:
            cjk_count += 1
        # Hangul Syllables
        elif 0xAC00 <= cp <= 0xD7AF:
            cjk_count += 1
        # CJK Extension A
        elif 0x3400 <= cp <= 0x4DBF:
            cjk_count += 1
        # Fullwidth forms
        elif 0xFF00 <= cp <= 0xFFEF:
            cjk_count += 1
    
    latin_count = len(text) - cjk_count
    return int((cjk_count / 1.5) + (latin_count / 3.5))


# Context cache (in-memory, invalidated on data changes)
_context_cache: Dict[str, Dict[str, Any]] = {}
_cache_timestamps: Dict[str, float] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def invalidate_context_cache(series_id: str):
    """Invalidate all cached contexts for a series."""
    keys_to_remove = [k for k in _context_cache if k.startswith(series_id)]
    for k in keys_to_remove:
        _context_cache.pop(k, None)
        _cache_timestamps.pop(k, None)


def get_context_info(series_id: str, chapter_id: str) -> Optional[Dict[str, Any]]:
    """
    Get token breakdown for a chapter's context window without full build.
    Lightweight - just estimates tokens, no LLM calls.
    
    Returns:
        dict with token breakdown or None
    """
    series = get_series(series_id)
    chapters = get_chapters(series_id)
    current_chapter = get_chapter(series_id, chapter_id)
    
    if not series or not current_chapter:
        return None
    
    # Use actual build_system_prompt to get accurate token count
    system_context = build_system_prompt(series)
    system_tokens = estimate_tokens(system_context)
    
    rolling_context, rolling_tokens = _build_rolling_context(
        chapters, current_chapter.get("chapterNumber", 1)
    )
    
    memory_context = _build_memory_context(series.get("memory", []))
    memory_tokens = estimate_tokens(memory_context)
    
    current_content = current_chapter.get("rawContent", "")
    current_tokens = estimate_tokens(current_content)
    
    total = system_tokens + rolling_tokens + memory_tokens + current_tokens
    
    return {
        "totalTokens": total,
        "availableTokens": AVAILABLE_CONTEXT_TOKENS,
        "maxTokens": MAX_CONTEXT_TOKENS,
        "fits": total <= AVAILABLE_CONTEXT_TOKENS,
        "utilization": round(total / AVAILABLE_CONTEXT_TOKENS * 100, 1),
        "breakdown": {
            "system": system_tokens,
            "rolling": rolling_tokens,
            "memory": memory_tokens,
            "current": current_tokens,
            "reserved": RESERVED_RESPONSE_TOKENS,
        },
        "summariesAvailable": len([c for c in chapters if c.get("chapterNumber", 0) < current_chapter.get("chapterNumber", 1) and c.get("summary", "").strip()]),
        "memoriesAvailable": len(series.get("memory", [])),
    }


def build_context_window(
    series_id: str,
    current_chapter_id: str,
    llm_client: Optional[LLMClient] = None,
    window_eval: Optional[Callable] = None
) -> Optional[Dict[str, Any]]:
    """
    Build the full context window for a chapter translation.
    
    The context window consists of:
    - Layer 1: System context (instructions + glossary)
    - Layer 2: Rolling context (summaries of previous chapters)
    - Layer 3: Memory context (compacted long-term memory)
    - Current: Raw content of the chapter to translate
    
    If total exceeds AVAILABLE_CONTEXT_TOKENS, auto-compact is triggered:
    1. First: reduce number of rolling summaries
    2. Then: compact older summaries into memory via LLM
    
    Args:
        series_id: Series UUID
        current_chapter_id: Chapter UUID to translate
        llm_client: LLM client for compaction (optional)
        window_eval: PyWebView evaluate_js callback (optional)
        
    Returns:
        dict with context components and token info, or None if error
    """
    series = get_series(series_id)
    chapters = get_chapters(series_id)
    current_chapter = get_chapter(series_id, current_chapter_id)
    
    if not series or not current_chapter:
        return None
    
    # === Layer 1: System Context (use actual prompt builder) ===
    system_context = build_system_prompt(series)
    system_tokens = estimate_tokens(system_context)
    
    # === Layer 2: Rolling Context (summaries of previous chapters) ===
    rolling_context, rolling_tokens = _build_rolling_context(
        chapters,
        current_chapter.get("chapterNumber", 1)
    )
    
    # === Layer 3: Memory Context (compacted long-term memory) ===
    memory_context = _build_memory_context(series.get("memory", []))
    memory_tokens = estimate_tokens(memory_context)
    
    # === Current Chapter Content ===
    current_content = current_chapter.get("rawContent", "")
    current_tokens = estimate_tokens(current_content)
    
    # === Calculate total ===
    total_tokens = system_tokens + rolling_tokens + memory_tokens + current_tokens
    
    # === Check cache ===
    import time
    cache_key = f"{series_id}:{current_chapter_id}"
    cached = _context_cache.get(cache_key)
    cached_ts = _cache_timestamps.get(cache_key, 0)
    
    # Use cache if valid (same token count and within TTL)
    if cached and cached["total_tokens"] == total_tokens and (time.time() - cached_ts) < CACHE_TTL_SECONDS:
        return cached
    
    # === Auto-Compact if over limit ===
    compacted = False
    if total_tokens > AVAILABLE_CONTEXT_TOKENS:
        rolling_context, rolling_tokens, compacted = _auto_compact(
            series_id=series_id,
            series=series,
            chapters=chapters,
            current_chapter=current_chapter,
            system_tokens=system_tokens,
            memory_tokens=memory_tokens,
            current_tokens=current_tokens,
            llm_client=llm_client,
            window_eval=window_eval
        )
        total_tokens = system_tokens + rolling_tokens + memory_tokens + current_tokens
    
    result = {
        "system_context": system_context,
        "rolling_context": rolling_context,
        "memory_context": memory_context,
        "current_content": current_content,
        "total_tokens": total_tokens,
        "compacted": compacted,
        "tokens_breakdown": {
            "system": system_tokens,
            "rolling": rolling_tokens,
            "memory": memory_tokens,
            "current": current_tokens,
            "available": AVAILABLE_CONTEXT_TOKENS,
            "max": MAX_CONTEXT_TOKENS,
        }
    }
    
    # Store in cache
    _context_cache[cache_key] = result
    _cache_timestamps[cache_key] = time.time()
    
    return result


def _collect_content_from_stream(stream) -> str:
    """
    Collect only delta.content from a streaming response.
    Skips delta.reasoning_content so deep-thinking models (GLM-4.7 etc.)
    don't exhaust the token budget with thinking before answering.
    """
    text = ""
    try:
        for chunk in stream:
            if not (hasattr(chunk, 'choices') and chunk.choices):
                continue
            delta = chunk.choices[0].delta
            if hasattr(delta, 'content') and delta.content:
                text += delta.content
    except Exception as e:
        print(f"[ContextWindow] Stream collection error: {e}")
    return text


def generate_chapter_summary(
    llm_client: LLMClient,
    translated_content: str,
    chapter_number: int,
    chapter_title: str = ""
) -> str:
    """
    Generate a concise summary of a translated chapter using LLM.
    Called automatically after each chapter translation completes.
    
    The summary is stored in chapter.json.summary and used as
    rolling context for subsequent chapter translations.
    
    Args:
        llm_client: LLM client instance
        translated_content: The full translated text
        chapter_number: Chapter number
        chapter_title: Chapter title (optional)
        
    Returns:
        str: Generated summary (empty string if failed)
    """
    # Use first 3000 chars for summary generation (enough context, saves tokens)
    text_for_summary = translated_content[:3000]
    if len(translated_content) > 3000:
        text_for_summary += "\n[...berlanjut]"
    
    title_info = f"Bab {chapter_number}"
    if chapter_title:
        title_info += f": {chapter_title}"
    
    messages = [
        {
            "role": "system",
            "content": (
                "Kamu adalah analis cerita novel. Buat ringkasan singkat bab berikut dalam Bahasa Indonesia.\n"
                "Fokus pada:\n"
                "- Peristiwa penting yang terjadi\n"
                "- Perkembangan karakter\n"
                "- Plot point penting\n"
                "- Informasi baru yang terungkap\n"
                "- Istilah/nama penting yang muncul\n\n"
                "Ringkasan harus padat (maksimal 500 karakter). Tulis dalam Bahasa Indonesia."
            )
        },
        {
            "role": "user",
            "content": f"Ringkas {title_info}:\n\n{text_for_summary}"
        }
    ]
    
    try:
        # stream=True: skip reasoning_content (thinking tokens) from deep-thinking models,
        # collect only delta.content so token budget is never consumed by thinking alone.
        stream = llm_client.complete(
            messages,
            stream=True,
            max_tokens=SUMMARY_GENERATION_MAX_TOKENS
        )
        summary = _collect_content_from_stream(stream)
        return summary.strip()
    except Exception as e:
        print(f"[ContextWindow] Summary generation failed: {e}")
        return ""


def _build_system_context(series: Dict[str, Any]) -> str:
    """Build Layer 1: System context from instructions + glossary"""
    context_parts = []
    
    # Custom instructions
    instructions = series.get("instructions", "").strip()
    if instructions:
        context_parts.append(f"Instruksi Khusus:\n{instructions}")
    
    # Glossary
    glossary = series.get("glossary", [])
    if glossary:
        table = "| Istilah Asli | Terjemahan | Catatan |\n"
        table += "|-------------|-----------|--------|\n"
        for entry in glossary:
            src = entry.get("sourceTerm", "")
            trn = entry.get("translatedTerm", "")
            nts = entry.get("notes", "")
            table += f"| {src} | {trn} | {nts} |\n"
        context_parts.append(f"Glossary:\n{table}")
    
    return "\n\n".join(context_parts)


def _build_rolling_context(
    chapters: List[Dict[str, Any]],
    current_chapter_number: int,
    max_summaries: int = 10
) -> tuple:
    """
    Build Layer 2: Rolling context from recent chapter summaries.
    
    Returns:
        tuple: (context_text, estimated_tokens)
    """
    # Get chapters BEFORE current that have summaries
    previous = [
        ch for ch in chapters
        if ch.get("chapterNumber", 0) < current_chapter_number
        and ch.get("summary", "").strip()
    ]
    
    if not previous:
        return "", 0
    
    # Sort by chapter number descending, take most recent
    previous.sort(key=lambda c: c.get("chapterNumber", 0), reverse=True)
    recent = previous[:max_summaries]
    
    # Sort back ascending for chronological display
    recent.sort(key=lambda c: c.get("chapterNumber", 0))
    
    context = "Konteks Bab Sebelumnya:\n\n"
    for ch in recent:
        num = ch.get("chapterNumber", "?")
        title = ch.get("title", "")
        summary = ch.get("summary", "")
        header = f"Bab {num}"
        if title:
            header += f": {title}"
        context += f"[{header}]\n{summary}\n\n"
    
    return context, estimate_tokens(context)


def _build_memory_context(memories: List[Dict[str, Any]]) -> str:
    """Build Layer 3: Memory context from compacted memories"""
    if not memories:
        return ""
    
    context = "Memori Cerita (Jangka Panjang):\n\n"
    for mem in memories:
        context += f"[{mem.get('range', 'Unknown')}]\n{mem.get('content', '')}\n\n"
    
    return context


def _auto_compact(
    series_id: str,
    series: Dict[str, Any],
    chapters: List[Dict[str, Any]],
    current_chapter: Dict[str, Any],
    system_tokens: int,
    memory_tokens: int,
    current_tokens: int,
    llm_client: Optional[LLMClient],
    window_eval: Optional[Callable]
) -> tuple:
    """
    Auto-compact context when total exceeds AVAILABLE_CONTEXT_TOKENS.
    
    Strategy:
    1. Reduce number of rolling summaries (keep only most recent)
    2. If LLM client available, trigger memory compaction for older summaries
    3. Return compacted rolling context
    
    Returns:
        tuple: (rolling_context, rolling_tokens, compacted_flag)
    """
    available_for_rolling = AVAILABLE_CONTEXT_TOKENS - system_tokens - memory_tokens - current_tokens
    
    if available_for_rolling < 0:
        # Even without rolling context, we're over limit
        # Current chapter itself is too large - nothing we can do
        print(f"[ContextWindow] WARNING: Current chapter alone exceeds available tokens "
              f"({current_tokens} > {AVAILABLE_CONTEXT_TOKENS - system_tokens - memory_tokens})")
        return "", 0, True
    
    # Step 1: Reduce rolling summaries to fit
    previous_with_summary = [
        ch for ch in chapters
        if ch.get("chapterNumber", 0) < current_chapter.get("chapterNumber", 1)
        and ch.get("summary", "").strip()
    ]
    previous_with_summary.sort(key=lambda c: c.get("chapterNumber", 0), reverse=True)
    
    rolling_context = ""
    rolling_tokens = 0
    compacted = False
    
    # Try progressively fewer summaries until we fit
    for count in range(len(previous_with_summary), 0, -1):
        context, tokens = _build_rolling_context(
            chapters,
            current_chapter.get("chapterNumber", 1),
            count
        )
        if tokens <= available_for_rolling:
            rolling_context = context
            rolling_tokens = tokens
            compacted = count < len(previous_with_summary)
            break
    
    # Step 2: If we had to drop summaries and have LLM client, compact into memory
    if compacted and llm_client and len(previous_with_summary) > 5:
        try:
            _trigger_memory_compaction(
                series_id, series, chapters, current_chapter, llm_client
            )
        except Exception as e:
            print(f"[ContextWindow] Memory compaction failed: {e}")
    
    return rolling_context, rolling_tokens, compacted


def _trigger_memory_compaction(
    series_id: str,
    series: Dict[str, Any],
    chapters: List[Dict[str, Any]],
    current_chapter: Dict[str, Any],
    llm_client: LLMClient
):
    """
    Compact older chapter summaries into a condensed memory block.
    
    Takes summaries of chapters NOT in the current rolling window
    and uses LLM to create a condensed story memory.
    """
    # Get all summarized chapters before current
    previous = [
        ch for ch in chapters
        if ch.get("chapterNumber", 0) < current_chapter.get("chapterNumber", 1)
        and ch.get("summary", "").strip()
    ]
    previous.sort(key=lambda c: c.get("chapterNumber", 0))
    
    if len(previous) < 5:
        return  # Not enough to compact
    
    # Keep the most recent 3 summaries in rolling context, compact the rest
    to_compact = previous[:-3]
    
    # Check if already compacted this range
    existing_memories = series.get("memory", [])
    if existing_memories:
        last_mem = existing_memories[-1]
        last_range = last_mem.get("range", "")
        # Simple check: if the last memory already covers up to the same point, skip
        try:
            last_end = int(last_range.split("-")[-1].replace("Bab ", "").strip())
            if last_end >= to_compact[-1].get("chapterNumber", 0):
                return  # Already compacted up to this point
        except (ValueError, IndexError):
            pass
    
    # Build summary text for compaction
    summaries_text = ""
    for ch in to_compact:
        num = ch.get("chapterNumber", "?")
        summary = ch.get("summary", "")
        summaries_text += f"Bab {num}: {summary}\n"
    
    if not summaries_text.strip():
        return
    
    # Call LLM to create condensed memory
    messages = [
        {
            "role": "system",
            "content": (
                "Kamu adalah analis cerita novel. Buat ringkasan padat dari ringkasan bab-bab berikut "
                "dalam Bahasa Indonesia.\n\n"
                "Fokus pada:\n"
                "- Karakter utama dan perkembangannya\n"
                "- Plot utama dan alur cerita\n"
                "- Lokasi dan dunia penting\n"
                "- Istilah/kemampuan kunci\n\n"
                "Hasil harus ringkas (maksimal 2000 karakter). Tulis dalam Bahasa Indonesia."
            )
        },
        {
            "role": "user",
            "content": f"Ringkas cerita dari bab-bab berikut:\n\n{summaries_text}"
        }
    ]
    
    try:
        stream = llm_client.complete(
            messages,
            stream=True,
            max_tokens=MEMORY_COMPACT_MAX_TOKENS
        )
        memory_text = _collect_content_from_stream(stream).strip()
        
        if not memory_text:
            return
        
        # Create memory entry
        first_ch = to_compact[0].get("chapterNumber", "?")
        last_ch = to_compact[-1].get("chapterNumber", "?")
        
        memory_entry = {
            "range": f"Bab {first_ch}-{last_ch}",
            "content": memory_text,
            "compactedAt": datetime.utcnow().isoformat() + "Z",
            "chapterCount": len(to_compact)
        }
        
        # Append to series memory
        memories = series.get("memory", [])
        memories.append(memory_entry)
        series["memory"] = memories
        series["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        
        # Save to disk
        series_path = get_series_path(series_id)
        if series_path and series_path.exists():
            with open(series_path, 'w', encoding='utf-8') as f:
                json.dump(series, f, indent=2, ensure_ascii=False)
            
            print(f"[ContextWindow] Memory compacted: Bab {first_ch}-{last_ch} "
                  f"({len(to_compact)} chapters -> {estimate_tokens(memory_text)} tokens)")
    
    except Exception as e:
        print(f"[ContextWindow] Memory compaction LLM call failed: {e}")


def _extract_response_text(result) -> str:
    """
    Extract text from LLM response (handles both streaming and non-streaming formats)
    """
    text = ""
    
    try:
        # Try iterating (streaming format)
        for chunk in result:
            if hasattr(chunk, 'choices') and chunk.choices:
                delta = chunk.choices[0]
                # Streaming delta format
                if hasattr(delta, 'delta') and hasattr(delta.delta, 'content'):
                    text += delta.delta.content or ""
                # Non-streaming message format
                elif hasattr(delta, 'message') and hasattr(delta.message, 'content'):
                    text += delta.message.content or ""
    except TypeError:
        # Not iterable - try direct access
        if hasattr(result, 'choices') and result.choices:
            msg = result.choices[0]
            if hasattr(msg, 'message') and hasattr(msg.message, 'content'):
                text = msg.message.content or ""
    
    return text