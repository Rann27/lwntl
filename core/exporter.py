"""
Exporter Module - Export translated chapters to .docx
Converts markdown translation output to a formatted Word document.
"""

import io
import re
from typing import Dict, Any

from docx import Document
from .extractor import strip_glossary_table
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


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


def _add_inline_content(paragraph, text: str):
    """
    Parse inline markdown and add runs to paragraph.
    Handles: ***bold-italic***, **bold**, *italic*, plain text.
    """
    # Pattern: match bold-italic, bold, italic spans (non-greedy)
    pattern = r'(\*{3}.+?\*{3}|\*{2}.+?\*{2}|\*.+?\*)'
    parts = re.split(pattern, text, flags=re.DOTALL)

    for part in parts:
        if not part:
            continue
        if part.startswith('***') and part.endswith('***') and len(part) > 6:
            run = paragraph.add_run(part[3:-3])
            run.bold   = True
            run.italic = True
        elif part.startswith('**') and part.endswith('**') and len(part) > 4:
            run = paragraph.add_run(part[2:-2])
            run.bold = True
        elif part.startswith('*') and part.endswith('*') and len(part) > 2:
            run = paragraph.add_run(part[1:-1])
            run.italic = True
        else:
            paragraph.add_run(part)


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


def export_chapter_to_docx(series: Dict[str, Any], chapter: Dict[str, Any]) -> bytes:
    """
    Convert a chapter's translated markdown content to .docx bytes.

    Args:
        series:  Series dict (title, sourceLanguage, targetLanguage)
        chapter: Chapter dict (chapterNumber, title, translatedContent)

    Returns:
        bytes: Raw .docx file content
    """
    doc = Document()
    _set_doc_margins(doc)
    _configure_normal_style(doc)

    series_title   = series.get('title', '')
    chapter_num    = chapter.get('chapterNumber', 1)
    chapter_title  = chapter.get('title', '').strip()
    content        = strip_glossary_table(chapter.get('translatedContent', ''))

    # ── Chapter heading ──────────────────────────────────────────────
    heading_text = f'Bab {chapter_num}'
    if chapter_title:
        heading_text += f' — {chapter_title}'

    h = doc.add_heading(heading_text, level=1)
    h.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in h.runs:
        run.font.name = 'Times New Roman'
        run.font.size = Pt(16)

    if series_title:
        sub = doc.add_paragraph(series_title)
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
        sub.paragraph_format.space_after = Pt(18)
        for run in sub.runs:
            run.font.name  = 'Times New Roman'
            run.font.size  = Pt(11)
            run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
            run.italic = True

    doc.add_paragraph()  # blank spacer

    # ── Body content ─────────────────────────────────────────────────
    # Split on blank lines to get logical paragraphs
    blocks = re.split(r'\n{2,}', content.strip())

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Heading lines (## Title)
        heading_match = re.match(r'^(#{1,4})\s+(.+)$', block)
        if heading_match:
            level = min(len(heading_match.group(1)) + 1, 4)
            text  = heading_match.group(2).strip()
            h = doc.add_heading(text, level=level)
            for run in h.runs:
                run.font.name = 'Times New Roman'
            continue

        # Scene break
        if _is_scene_break(block):
            _add_scene_break(doc)
            continue

        # Multi-line block: split on single newlines and join with space,
        # but preserve lines that look like list items / dialogue.
        lines = block.split('\n')

        if len(lines) == 1:
            p = doc.add_paragraph()
            _add_inline_content(p, block)
        else:
            # Treat as single paragraph with soft line breaks preserved
            p = doc.add_paragraph()
            for i, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue
                if i > 0:
                    # soft break between lines within same block
                    run = p.add_run('\n')
                _add_inline_content(p, line)

    # ── Save to bytes ─────────────────────────────────────────────────
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.getvalue()
