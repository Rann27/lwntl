"""
LWNTL Document Parser
Parses DOCX and PDF files into clean markdown text.
"""

import io
import re
from typing import Dict, Any, Set


def _filename_to_title(filename: str) -> str:
    name = filename.rsplit('.', 1)[0]
    return re.sub(r'[_\-]+', ' ', name).strip()


# ─── DOCX ─────────────────────────────────────────────────────────────────────

def parse_docx(data: bytes, filename: str) -> Dict[str, Any]:
    try:
        from docx import Document
        from docx.oxml.ns import qn
    except ImportError:
        return {"error": True, "message": "python-docx not installed"}

    doc = Document(io.BytesIO(data))
    paragraphs_out = []
    title = None
    img_counter = 0

    HEADING_MAP = {
        'heading 1': '#', 'heading 2': '##',
        'heading 3': '###', 'heading 4': '####',
    }

    for para in doc.paragraphs:
        style = (para.style.name or '').lower() if para.style else ''

        # Detect inline images via relationship IDs embedded in the run XML
        images_in_para = []
        for run in para.runs:
            for blip in run._r.findall('.//' + qn('a:blip')):
                r_embed = blip.get(qn('r:embed'))
                if r_embed and r_embed in doc.part.rels:
                    img_name = doc.part.rels[r_embed].target_ref.split('/')[-1]
                    images_in_para.append(img_name)
                else:
                    img_counter += 1
                    images_in_para.append(f"image_{img_counter}.jpg")
            for v_img in run._r.findall('.//' + qn('v:imagedata')):
                r_id = v_img.get(qn('r:id'))
                if r_id and r_id in doc.part.rels:
                    img_name = doc.part.rels[r_id].target_ref.split('/')[-1]
                    images_in_para.append(img_name)

        if images_in_para:
            for img_name in images_in_para:
                paragraphs_out.append(f"Image Placeholder: {img_name}")
            continue

        text = para.text.strip()
        if not text:
            continue

        # Heading styles → markdown prefix
        for key, prefix in HEADING_MAP.items():
            if key in style:
                if title is None and key == 'heading 1':
                    title = text
                paragraphs_out.append(f"{prefix} {text}")
                break
        else:
            # Normal paragraph: reconstruct with inline bold/italic formatting
            result = ''
            for run in para.runs:
                t = run.text
                if not t:
                    continue
                if run.bold and run.italic:
                    result += f"***{t}***"
                elif run.bold:
                    result += f"**{t}**"
                elif run.italic:
                    result += f"*{t}*"
                else:
                    result += t
            if result.strip():
                paragraphs_out.append(result)

    content = '\n\n'.join(paragraphs_out)
    content = re.sub(r'\n{3,}', '\n\n', content).strip()

    return {
        "title": title or _filename_to_title(filename),
        "content": content,
        "charCount": len(content),
    }


# ─── PDF ──────────────────────────────────────────────────────────────────────

def parse_pdf(data: bytes, filename: str) -> Dict[str, Any]:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return {"error": True, "message": "PyMuPDF not installed. Run: pip install pymupdf"}

    doc = fitz.open(stream=data, filetype="pdf")

    if doc.page_count == 0:
        doc.close()
        return {"title": _filename_to_title(filename), "content": "", "charCount": 0}

    hf_texts = _detect_hf(doc)
    body_size = _detect_body_size(doc)
    heading_min = body_size * 1.18

    PAGE_NUM_RE = re.compile(r'^\s*[\-–—]?\s*\d{1,5}\s*[\-–—]?\s*$')

    blocks_out = []
    title = None
    img_counter = 0

    for page_num in range(doc.page_count):
        page = doc[page_num]
        ph = page.rect.height
        pw = page.rect.width

        raw_blocks = list(page.get_text("dict", flags=0)["blocks"])

        # Inject images that don't appear as type==1 blocks in get_text output.
        # These are typically full-page illustrations stored as page-level XObjects.
        existing_type1_ys = {round(b["bbox"][1]) for b in raw_blocks if b["type"] == 1}
        for info in page.get_image_info(hashes=False, xrefs=True):
            bx0, by0, bx1, by1 = info["bbox"]
            w, h = info.get("width", 0), info.get("height", 0)
            area = (bx1 - bx0) * abs(by1 - by0) / max(pw * ph, 1)
            # Only inject for substantial images not already captured
            if w > 100 and h > 100 and area > 0.05 and round(by0) not in existing_type1_ys:
                raw_blocks.append({"type": 1, "bbox": (bx0, by0, bx1, by1)})

        for block in sorted(raw_blocks, key=lambda b: b["bbox"][1]):
            btype = block["type"]
            by0, by1 = block["bbox"][1], block["bbox"][3]

            if btype == 1:  # Image block
                img_counter += 1
                blocks_out.append(
                    f"Image Placeholder: image_p{page_num + 1}_{img_counter}.jpg"
                )
                continue

            # Process lines within a block.
            # Two kinds of splits:
            # 1. Color change: heading + body often share a block (different colors).
            # 2. Whitespace-only line: some PDFs pack all body text in one block
            #    and use blank-space lines as paragraph separators.
            groups: list[tuple[list[str], float, int | None]] = []  # (lines, max_size, color)
            cur_lines: list[str] = []
            cur_size = 0.0
            cur_color: int | None = None

            for line in block.get("lines", []):
                line_str = ''
                line_size = 0.0
                line_color: int | None = None
                prev_span_x1: float | None = None  # right edge of previous span

                for span in line.get("spans", []):
                    t = span.get("text", "")
                    sz = span.get("size", body_size)
                    fl = span.get("flags", 0)
                    color = span.get("color", 0)
                    bold = bool(fl & 16)
                    italic = bool(fl & 2)
                    bbox = span.get("bbox", (0, 0, 0, 0))

                    line_size = max(line_size, sz)
                    if line_color is None:
                        line_color = color

                    if t:
                        # Detect visual gap between consecutive spans: if the left
                        # edge of this span is sufficiently far from the right edge of
                        # the previous one, there is a visual space that the PDF did
                        # not encode as a space character (common with mixed-style or
                        # furigana-annotated text such as 《TitleIndonesian》).
                        if (prev_span_x1 is not None
                                and line_str
                                and not line_str[-1].isspace()
                                and not t[0].isspace()):
                            gap = bbox[0] - prev_span_x1
                            if gap > sz * 0.25:
                                line_str += " "

                        if bold and italic:
                            line_str += f"***{t}***"
                        elif bold:
                            line_str += f"**{t}**"
                        elif italic:
                            line_str += f"*{t}*"
                        else:
                            line_str += t

                        prev_span_x1 = bbox[2]

                stripped = line_str.strip()
                # A bold/italic whitespace span produces e.g. "** **" — strip
                # markdown markers to check whether the line is actually empty.
                stripped_plain = re.sub(r'\*+', '', stripped).strip()

                # Whitespace-only line → paragraph separator: flush and start fresh
                if not stripped_plain:
                    if cur_lines:
                        groups.append((list(cur_lines), cur_size, cur_color))
                    cur_lines, cur_size, cur_color = [], 0.0, None
                    continue

                # Color change → new paragraph group
                if cur_lines and line_color != cur_color:
                    groups.append((list(cur_lines), cur_size, cur_color))
                    cur_lines, cur_size, cur_color = [], 0.0, None

                cur_lines.append(stripped)
                cur_size = max(cur_size, line_size)
                if cur_color is None:
                    cur_color = line_color

            if cur_lines:
                groups.append((cur_lines, cur_size, cur_color))

            for grp_lines, max_size, grp_color in groups:
                # Join lines, collapsing line-break hyphens (e.g. "ber-\npura" → "berpura")
                joined_parts: list[str] = []
                for i, ln in enumerate(grp_lines):
                    if joined_parts and joined_parts[-1].endswith('-'):
                        # Check if it's a line-break hyphen: next fragment starts lowercase
                        next_char = ln[0] if ln else ''
                        if next_char and (next_char.islower() or next_char.isdigit()):
                            # Keep the hyphen, just remove the inter-line space.
                            # For true line-break hyphens this keeps "word-" + "cont"
                            # → "word-cont"; for Indonesian reduplication "berpura-" +
                            # "pura" → "berpura-pura" (both correct).
                            joined_parts[-1] = joined_parts[-1] + ln
                            continue
                    joined_parts.append(ln)
                para = ' '.join(joined_parts).strip()
                if not para:
                    continue

                plain = re.sub(r'\*+', '', para).strip()

                if plain in hf_texts:
                    continue
                if PAGE_NUM_RE.match(plain):
                    continue

                # Heading if: font size significantly larger than body
                # OR colored (non-black) + at least body size.
                # Cap at 80 chars: chapter titles in LNs are usually under that;
                # longer colored text is likely an in-text emphasis, not a heading.
                is_colored_heading = (
                    grp_color is not None
                    and grp_color != 0
                    and max_size >= body_size
                    and len(plain) < 80
                )
                if max_size >= heading_min or is_colored_heading:
                    if title is None:
                        title = plain
                    blocks_out.append(f"# {plain}")
                else:
                    blocks_out.append(para)

    doc.close()

    # Post-process: merge bracket fragments split across blocks.
    # PDFs sometimes place 《Title》 constructs across block boundaries:
    #   block N:   "...sentence 《"        (ends with open bracket)
    #   block N+1: "Title》 rest..."       (starts with close bracket content)
    # or the closing bracket ends up alone:
    #   block N:   "...TitleContent"
    #   block N+1: "》."
    _CLOSE_BRACKET_RE = re.compile(r'^[》〉\]】〕）]+')
    merged: list[str] = []
    for blk in blocks_out:
        if merged and not blk.startswith('#'):
            prev = merged[-1]
            if not prev.startswith('#'):
                plain_prev = prev.rstrip()
                # Previous block ends with an open bracket → absorb this block
                if plain_prev.endswith('《') or plain_prev.endswith('〈'):
                    merged[-1] = plain_prev + blk
                    continue
                # This block is an orphaned closing bracket fragment
                if _CLOSE_BRACKET_RE.match(blk.strip()):
                    merged[-1] = plain_prev + blk.strip()
                    continue
        merged.append(blk)
    blocks_out = merged

    content = '\n\n'.join(blocks_out)
    content = re.sub(r'\n{3,}', '\n\n', content).strip()

    return {
        "title": title or _filename_to_title(filename),
        "content": content,
        "charCount": len(content),
    }


# ─── PDF FLOW (paragraph reconstruction for line-break PDFs) ─────────────────

# Terminal punctuation: these end a sentence → do NOT merge into next block
_SENT_END_RE = re.compile(
    r'(?:[.!?。！？]|[…]+|\.{3,}|[""」』》〉）\)])\s*$'
)
# Opening quote/bracket at start of block → always a fresh paragraph
_OPEN_QUOTE_RE = re.compile(r'^[""「『《〈（(]')
# Lines consisting solely of ornamental/separator characters
_ORNAMENT_ONLY_RE = re.compile(
    r'^[◇◆◈♦◂◊○●◎'
    r'□■△▲▽▼☆★'
    r'◌◍◉⊗⊕—–―─\s]+$'
)


def _reconstruct_paragraphs(blocks: list) -> list:
    """
    Merge line-break fragment blocks into proper paragraphs.
    Used for PDFs where each visual line becomes a separate block.
    Lines that don't end with terminal punctuation are joined to the next
    unless the next line starts a new semantic unit (dialogue, separator, etc.).
    """
    out: list = []
    buf = ""

    for blk in blocks:
        stripped = blk.strip()

        # ── Standalone trailing punctuation (e.g. ！ or ？ on its own line) ──
        # These have no alphabetic/digit content and are very short.
        # Always attach to preceding content without a space.
        if stripped and len(stripped) <= 5 and not any(c.isalpha() or c.isdigit() for c in stripped):
            if buf:
                buf = buf.rstrip() + stripped
            elif out and not out[-1].startswith('Image Placeholder'):
                out[-1] = out[-1].rstrip() + stripped
            continue

        # ── Pass-through: headings, image placeholders, ornament-only lines ──
        if (blk.startswith('#')
                or blk.startswith('Image Placeholder')
                or _ORNAMENT_ONLY_RE.match(stripped)):
            if buf:
                out.append(buf)
                buf = ""
            # Consecutive heading lines without terminal punctuation → merge.
            # Handles chapter titles that wrap across two PDF lines:
            #   "# Chapter 1 Some Long"  +  "# Title Continuation"
            #   → "# Chapter 1 Some Long Title Continuation"
            if (blk.startswith('#')
                    and out
                    and out[-1].startswith('#')
                    and not _SENT_END_RE.search(out[-1])):
                out[-1] = out[-1] + " " + stripped.lstrip('#').strip()
            else:
                out.append(blk)
            continue

        if not buf:
            # Short noun-phrase immediately after an incomplete heading →
            # likely the second line of a wrapped chapter title.
            # Conditions: previous output is a heading, current block is very
            # short, has no comma (not a sentence fragment), and doesn't start
            # a new unit.
            if (out
                    and out[-1].startswith('#')
                    and len(out[-1]) > 10          # heading itself isn't trivial
                    and not _SENT_END_RE.search(stripped)
                    and not _OPEN_QUOTE_RE.match(stripped)
                    and not _ORNAMENT_ONLY_RE.match(stripped)
                    and len(stripped) < 35
                    and ',' not in stripped
                    and '，' not in stripped):
                out[-1] = out[-1] + " " + stripped
                continue
            buf = blk
            continue

        ends_sentence = bool(_SENT_END_RE.search(buf.rstrip()))
        starts_new = bool(_OPEN_QUOTE_RE.match(stripped) or _ORNAMENT_ONLY_RE.match(stripped))

        if ends_sentence or starts_new:
            out.append(buf)
            buf = blk
        else:
            buf = buf.rstrip() + " " + stripped

    if buf:
        out.append(buf)

    return out


def parse_pdf_flow(data: bytes, filename: str) -> Dict[str, Any]:
    """
    PDF parser with paragraph reconstruction for PDFs with forced line breaks
    (each visual line is a separate PDF block).  Runs parse_pdf then merges
    fragment blocks into proper paragraphs using end-punctuation heuristics.
    """
    result = parse_pdf(data, filename)
    if result.get("error"):
        return result

    blocks = [b for b in result["content"].split("\n\n") if b.strip()]
    merged = _reconstruct_paragraphs(blocks)
    content = "\n\n".join(merged)
    content = re.sub(r'\n{3,}', '\n\n', content).strip()

    return {
        "title": result["title"],
        "content": content,
        "charCount": len(content),
    }


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def _detect_hf(doc) -> Set[str]:
    """Detect running header/footer text (appears at same vertical zone across many pages)."""
    candidates: Dict[str, int] = {}
    sample = min(doc.page_count, 12)
    for i in range(sample):
        page = doc[i]
        ph = page.rect.height
        margin = ph * 0.08
        for b in page.get_text("blocks"):
            x0, y0, x1, y1, text = b[:5]
            text = text.strip()
            if text and (y1 <= margin or y0 >= ph - margin):
                candidates[text] = candidates.get(text, 0) + 1
    threshold = max(2, sample * 0.3)
    return {t for t, c in candidates.items() if c >= threshold}


def _detect_body_size(doc) -> float:
    """Find dominant (body) font size by character count across sampled pages."""
    size_chars: Dict[float, int] = {}
    for i in range(min(doc.page_count, 8)):
        page = doc[i]
        ph = page.rect.height
        margin = ph * 0.08
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            by0, by1 = block["bbox"][1], block["bbox"][3]
            if by1 <= margin or by0 >= ph - margin:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    sz = round(span.get("size", 0), 1)
                    chars = len(span.get("text", ""))
                    if sz > 0 and chars > 0:
                        size_chars[sz] = size_chars.get(sz, 0) + chars
    return max(size_chars, key=size_chars.get) if size_chars else 11.0
