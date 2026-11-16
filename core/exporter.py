"""
Exporter Module - Export translated chapters to .docx
Converts markdown translation output to a formatted Word document.
Every export uses the series' Word template (see core/doc_templates.py).
"""

import io
import re
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

from docx import Document
from .extractor import strip_glossary_table
from .placeholder import is_placeholder_line, placeholder_filename
from .storage.chapters import get_chapter_assets_dir
from docx.shared import Pt, Cm, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.enum.style import WD_STYLE_TYPE
from . import doc_templates

def _placeholder_filename(line: str):
    """Return (is_placeholder, filename|None) for a stripped line."""
    if not is_placeholder_line(line):
        return False, None
    return True, placeholder_filename(line)


# Assumed resolution for images that carry no DPI metadata. Illustrations pulled
# out of a PDF routinely report 0 dpi, which makes python-docx's native-size math
# (px / dpi) raise ZeroDivisionError.
_DEFAULT_DPI = 96


def _image_emu_size(path: Path):
    """Return (width, height) in EMU for an image, tolerating missing DPI metadata.

    Returns (None, None) when the size cannot be determined, in which case the
    caller should let python-docx decide.
    """
    try:
        from docx.image.image import Image as DocxImage
        img = DocxImage.from_file(str(path))
        px_w, px_h = img.px_width, img.px_height
        if not px_w or not px_h:
            return None, None
        dpi_x = img.horz_dpi or _DEFAULT_DPI
        dpi_y = img.vert_dpi or _DEFAULT_DPI
        # A zero/negative/absurd dpi means "unknown" — fall back to the default.
        if dpi_x <= 0:
            dpi_x = _DEFAULT_DPI
        if dpi_y <= 0:
            dpi_y = _DEFAULT_DPI
        return Inches(px_w / dpi_x), Inches(px_h / dpi_y)
    except Exception:
        return None, None


def _add_image_to_doc(doc: Document, series_id: str, chapter_id: str, filename: str) -> bool:
    """Insert an imported illustration at the current end of the document.

    Scaled to fit the page content box (never upscaled), centered.
    Returns True if the image was added, False if its bytes were not found.
    """
    if not filename:
        return False
    path = get_chapter_assets_dir(series_id, chapter_id) / Path(filename).name
    if not path.exists():
        return False
    try:
        section = doc.sections[0]
        max_w = section.page_width - section.left_margin - section.right_margin
        max_h = section.page_height - section.top_margin - section.bottom_margin

        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(10)
        # An illustration owns its page: start a new one here. The caller queues a
        # matching break for whatever follows, so nothing shares the page.
        # page_break_before is used instead of a separate break paragraph so no
        # stray empty paragraph (and no blank page) is left behind.
        p.paragraph_format.page_break_before = True
        run = p.add_run()

        # Compute the size ourselves so python-docx never has to divide by a
        # missing DPI. Passing BOTH width and height also skips its internal
        # scaled_dimensions() call, which would hit the same division.
        w, h = _image_emu_size(path)
        if w and h:
            # Fit inside the content box, preserving aspect ratio, never upscaling.
            scale = min(max_w / w, max_h / h, 1.0)
            run.add_picture(str(path), width=int(w * scale), height=int(h * scale))
        else:
            # Size unknown — let python-docx try, then clamp the width if needed.
            pic = run.add_picture(str(path))
            if pic.width and pic.width > max_w:
                ratio = max_w / pic.width
                pic.width = int(pic.width * ratio)
                pic.height = int(pic.height * ratio)
        return True
    except Exception as e:
        print(f"[Export] Failed to embed image {filename}: {e}")
        return False

# Unicode ranges not reliably covered by Times New Roman (or any single Latin font).
# These need an explicit fallback so Word doesn't corrupt them.
_UNICODE_FALLBACK_RANGES = (
    (0x2030, 0x206F),  # General Punctuation extras: ※ ‼ ⁇ etc. (em/en dash & quotes are below 0x2030, safe)
    (0x2190, 0x23FF),  # Arrows + Supplemental Arrows + Misc Technical
    (0x2400, 0x27BF),  # Box Drawing / Geometric Shapes / Misc Symbols / Dingbats
    (0x2E80, 0x2EFF),  # CJK Radicals Supplement
    (0x3000, 0x303F),  # CJK Symbols and Punctuation
    (0x3040, 0x30FF),  # Hiragana / Katakana
    (0x4E00, 0x9FFF),  # CJK Unified Ideographs
    (0xAC00, 0xD7AF),  # Hangul Syllables
    (0xFF00, 0xFFEF),  # Halfwidth / Fullwidth Forms
)
# A single Unicode-capable font available on Windows 8+ and all Office installs.
_FALLBACK_FONT = 'Segoe UI Symbol'


def _char_needs_fallback(ch: str) -> bool:
    cp = ord(ch)
    return any(lo <= cp <= hi for lo, hi in _UNICODE_FALLBACK_RANGES)


def _split_for_font(text: str):
    """Yield (segment, needs_fallback_font) pairs."""
    if not text:
        return
    cur = [text[0]]
    cur_fallback = _char_needs_fallback(text[0])
    for ch in text[1:]:
        fb = _char_needs_fallback(ch)
        if fb == cur_fallback:
            cur.append(ch)
        else:
            yield ''.join(cur), cur_fallback
            cur = [ch]
            cur_fallback = fb
    yield ''.join(cur), cur_fallback


def _add_run(paragraph, text: str, bold: bool = False, italic: bool = False,
             base_font: Optional[str] = 'Times New Roman'):
    """Add text as one or more runs, switching to fallback font for Unicode symbols.
    Pass base_font=None to inherit font from the paragraph style (e.g. when using a template)."""
    for segment, needs_fallback in _split_for_font(text):
        run = paragraph.add_run(segment)
        if bold:
            run.bold = True
        if italic:
            run.italic = True
        if needs_fallback:
            run.font.name = _FALLBACK_FONT
        elif base_font is not None:
            run.font.name = base_font


# Look of headings the exporter creates when a template lacks them (a blank
# document saved from Word only stores the styles it has used).
_HEADING_FALLBACK = {1: (16, True), 2: (14, True), 3: (13, True), 4: (12, True)}


def _ensure_heading_styles(doc: Document):
    """Create Heading 1-4 from Normal when the template does not define them."""
    for level, (size, bold) in _HEADING_FALLBACK.items():
        name = f'Heading {level}'
        try:
            doc.styles[name]
            continue
        except KeyError:
            pass
        st = doc.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        st.base_style = doc.styles['Normal']
        st.next_paragraph_style = doc.styles['Normal']
        st.font.size = Pt(size)
        st.font.bold = bold
        pf = st.paragraph_format
        pf.keep_with_next = True
        pf.first_line_indent = Pt(0)
        pf.space_before = Pt(18 if level == 1 else 12)
        pf.space_after = Pt(12 if level == 1 else 6)
        if level == 1:
            pf.alignment = WD_ALIGN_PARAGRAPH.CENTER


def _open_template_doc(series: Optional[Dict[str, Any]] = None, template_id: Optional[str] = None) -> tuple:
    """
    Returns (doc, template_id_or_None).
    Opens the series' template (or `template_id`) and clears its body while keeping
    styles, page setup, header and footer. Falls back to a fresh Document when no
    template file is usable.
    """
    if template_id:
        tpl_id, tpl_path = template_id, doc_templates.template_path(template_id)
    else:
        tpl_id, tpl_path = doc_templates.resolve_for_series(series)
    if tpl_path:
        try:
            doc = Document(str(tpl_path))
            body = doc.element.body
            for child in list(body):
                if child.tag != qn('w:sectPr'):
                    body.remove(child)
            _ensure_heading_styles(doc)
            return doc, tpl_id
        except Exception as e:
            print(f"[Export] Template {tpl_id} unusable, using defaults: {e}")
    return Document(), None


def _set_doc_margins(doc: Document):
    """Set comfortable reading margins."""
    for section in doc.sections:
        section.top_margin    = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin   = Cm(3.0)
        section.right_margin  = Cm(3.0)


def _configure_normal_style(doc: Document):
    """Configure Normal style: serif font, comfortable line spacing."""
    style = doc.styles['Normal']
    font  = style.font
    font.name = 'Times New Roman'
    font.size = Pt(12)
    pf = style.paragraph_format
    pf.space_after  = Pt(6)
    pf.line_spacing = Pt(20)


def _add_inline_content(paragraph, text: str, base_font: Optional[str] = 'Times New Roman'):
    """
    Parse inline markdown and add runs to paragraph.
    Handles: ***bold-italic***, **bold**, *italic*, plain text.
    Each run is split by character type so Unicode symbols get a proper fallback font.
    Pass base_font=None to inherit font from paragraph style (template use).
    """
    pattern = r'(\*{3}.+?\*{3}|\*{2}.+?\*{2}|\*.+?\*)'
    parts = re.split(pattern, text, flags=re.DOTALL)

    for part in parts:
        if not part:
            continue
        if part.startswith('***') and part.endswith('***') and len(part) > 6:
            _add_run(paragraph, part[3:-3], bold=True, italic=True, base_font=base_font)
        elif part.startswith('**') and part.endswith('**') and len(part) > 4:
            _add_run(paragraph, part[2:-2], bold=True, base_font=base_font)
        elif part.startswith('*') and part.endswith('*') and len(part) > 2:
            _add_run(paragraph, part[1:-1], italic=True, base_font=base_font)
        else:
            _add_run(paragraph, part, base_font=base_font)


def _is_scene_break(text: str) -> bool:
    """Return True if the line is a scene-break marker (*** / --- / ___)."""
    return bool(re.match(r'^(\*{3}|-{3,}|_{3,})$', text.strip()))


def _add_scene_break(doc: Document):
    """Add a centered *** paragraph as a scene break."""
    p = doc.add_paragraph('* * *')
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after  = Pt(12)
    for run in p.runs:
        run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
    return p


def _add_page_break(doc: Document):
    """Insert a hard page break as an empty paragraph."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run()
    br = OxmlElement('w:br')
    br.set(qn('w:type'), 'page')
    run._r.append(br)


_HEADING_LINE = re.compile(r'^(#{1,6})\s+(.+?)\s*#*\s*$')


def _add_chapter_to_doc(
    doc: Document,
    series: Dict[str, Any],
    chapter: Dict[str, Any],
    use_template_styles: bool = False,
):
    """
    Append a single chapter's content to an existing Document.

    No title is generated: the chapter's own markdown headings carry it
    (`#` → Heading 1, `##` → Heading 2, ...), so the document outline matches
    the translation. If use_template_styles=True, fonts come from the template.
    """
    content = strip_glossary_table(chapter.get('translatedContent', ''))

    # When using template, inherit body font from template's Normal style.
    # When not using template, explicitly set Times New Roman.
    body_base_font = None if use_template_styles else 'Times New Roman'

    series_id  = series.get('id', '')
    chapter_id = chapter.get('id', '')

    # Body content — split on blank lines. Isolate any image-placeholder line into
    # its own block so it renders as a real embedded image, not paragraph text.
    # Markdown headings are isolated the same way, so "# Title" directly followed
    # by text (no blank line) still becomes a heading instead of literal "#".
    raw_blocks = re.split(r'\n{2,}', content.strip())
    blocks: List[str] = []
    for block in raw_blocks:
        lines = block.split('\n')
        if not any(is_placeholder_line(ln.strip()) or _HEADING_LINE.match(ln.strip()) for ln in lines):
            blocks.append(block)
            continue
        buf: List[str] = []
        for ln in lines:
            if is_placeholder_line(ln.strip()) or _HEADING_LINE.match(ln.strip()):
                if buf:
                    blocks.append('\n'.join(buf))
                    buf = []
                blocks.append(ln.strip())
            else:
                buf.append(ln)
        if buf:
            blocks.append('\n'.join(buf))

    # Set after an illustration so the next body element starts on a fresh page,
    # leaving the illustration alone on its own. Applied to the element itself
    # rather than as a standalone break paragraph, so a trailing illustration
    # never produces an empty page.
    pending_break = False

    def _claim_break(par):
        """Apply a queued page break to the element just created."""
        nonlocal pending_break
        if pending_break and par is not None:
            par.paragraph_format.page_break_before = True
            pending_break = False

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Image placeholder → embed the actual illustration (fall back to text if
        # the bytes are missing, e.g. a manually typed placeholder with no asset).
        is_ph, ph_file = _placeholder_filename(block)
        if is_ph:
            if _add_image_to_doc(doc, series_id, chapter_id, ph_file):
                # The image paragraph already broke the page; isolate what follows.
                pending_break = True
                continue
            # No asset found — keep the placeholder text so nothing is silently lost.
            p = doc.add_paragraph()
            _claim_break(p)
            _add_inline_content(p, block, base_font=body_base_font)
            continue

        heading_match = _HEADING_LINE.match(block)
        if heading_match:
            # Heading 1-4 are guaranteed to exist (see _ensure_heading_styles).
            level = min(len(heading_match.group(1)), 4)
            h = doc.add_paragraph(style=f'Heading {level}')
            _claim_break(h)
            _add_inline_content(h, heading_match.group(2).strip(),
                                base_font=None if use_template_styles else 'Times New Roman')
            continue

        if _is_scene_break(block):
            _claim_break(_add_scene_break(doc))
            continue

        lines = block.split('\n')
        if len(lines) == 1:
            p = doc.add_paragraph()
            _claim_break(p)
            _add_inline_content(p, block, base_font=body_base_font)
        else:
            p = doc.add_paragraph()
            _claim_break(p)
            for i, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue
                if i > 0:
                    p.add_run('\n')
                _add_inline_content(p, line, base_font=body_base_font)


def _finish(doc: Document) -> bytes:
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.getvalue()


def export_chapter_to_docx(series: Dict[str, Any], chapter: Dict[str, Any],
                           template_id: Optional[str] = None) -> bytes:
    """Export a single chapter to .docx bytes with the series' template."""
    doc, used = _open_template_doc(series, template_id)
    if not used:
        _set_doc_margins(doc)
        _configure_normal_style(doc)
    _add_chapter_to_doc(doc, series, chapter, use_template_styles=bool(used))
    return _finish(doc)


def export_series_to_docx(series: Dict[str, Any], chapters: List[Dict[str, Any]],
                          template_id: Optional[str] = None) -> tuple:
    """
    Export all provided chapters into a single merged .docx with the series' template.
    Each chapter starts on a new page.

    Returns:
        (bytes, template_id or None when the built-in fallback styling was used)
    """
    doc, used = _open_template_doc(series, template_id)
    if not used:
        _set_doc_margins(doc)
        _configure_normal_style(doc)

    for i, chapter in enumerate(chapters):
        if i > 0:
            _add_page_break(doc)
        _add_chapter_to_doc(doc, series, chapter, use_template_styles=bool(used))
    return _finish(doc), used
