"""
Build the built-in .docx export templates in core/docx_templates/.

classic.docx is the hand-made template the app always shipped (formerly
TemplateNew.docx) and is left untouched. The others are generated here so their
styles stay reproducible:

    plain.docx      Times New Roman 12 pt on A4, the look LWNTL used without a template
    novel-a5.docx   A5 book page: Georgia, first-line indents, no gaps, page numbers
    screen.docx     Reading on screen: Segoe UI, airy line height, left aligned

Run:  venv/Scripts/python.exe tools/build_docx_templates.py
"""

import json
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

OUT = Path(__file__).resolve().parent.parent / "core" / "docx_templates"

INDEX = [
    {"id": "classic", "file": "classic.docx", "name": "Classic",
     "description": "Template bawaan LWNTL sejak awal: A4, Noto Sans, judul bab Constantia di tengah."},
    {"id": "plain", "file": "plain.docx", "name": "Polos",
     "description": "Times New Roman 12 pt di A4 dengan margin lega. Tampilan ekspor LWNTL tanpa template."},
    {"id": "novel-a5", "file": "novel-a5.docx", "name": "Novel A5",
     "description": "Halaman buku A5: Georgia, indentasi baris pertama tanpa jarak antarparagraf, nomor halaman."},
    {"id": "screen", "file": "screen.docx", "name": "Baca di layar",
     "description": "Segoe UI dengan spasi lapang dan jarak antarparagraf, enak dibaca di monitor atau tablet."},
]


def _set_font(style, name: str):
    """Set a style's font and drop theme fonts, which would otherwise win in Word."""
    style.font.name = name
    rpr = style.element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.insert(0, fonts)
    for attr in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
        fonts.attrib.pop(qn(attr), None)
    for attr in ("w:ascii", "w:hAnsi", "w:cs"):
        fonts.set(qn(attr), name)


def _style(doc, name, font=None, size=None, bold=None, italic=None, color=None,
           align=None, before=None, after=None, line=None, line_rule=None,
           indent=None, keep_next=None):
    st = doc.styles[name]
    if font:
        _set_font(st, font)
    if size is not None:
        st.font.size = Pt(size)
    if bold is not None:
        st.font.bold = bold
    if italic is not None:
        st.font.italic = italic
    if color is not None:
        st.font.color.rgb = RGBColor.from_string(color)
    pf = st.paragraph_format
    if align is not None:
        pf.alignment = align
    if before is not None:
        pf.space_before = Pt(before)
    if after is not None:
        pf.space_after = Pt(after)
    if line is not None:
        pf.line_spacing = line
    if line_rule is not None:
        pf.line_spacing_rule = line_rule
    if indent is not None:
        pf.first_line_indent = Cm(indent) if indent else Cm(0)
    if keep_next is not None:
        pf.keep_with_next = keep_next
    return st


def _page(doc, width, height, top, bottom, left, right, footer_distance=1.0):
    s = doc.sections[0]
    s.orientation = WD_ORIENT.PORTRAIT
    s.page_width, s.page_height = Cm(width), Cm(height)
    s.top_margin, s.bottom_margin = Cm(top), Cm(bottom)
    s.left_margin, s.right_margin = Cm(left), Cm(right)
    s.footer_distance = Cm(footer_distance)
    return s


def _page_number_footer(section, font, size):
    p = section.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    run.font.name, run.font.size = font, Pt(size)
    for tag, text in (("begin", None), (None, "PAGE"), ("end", None)):
        if tag:
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), tag)
        else:
            el = OxmlElement("w:instrText")
            el.set(qn("xml:space"), "preserve")
            el.text = text
        run._r.append(el)


def _clear_body(doc):
    body = doc.element.body
    for child in list(body):
        if child.tag != qn("w:sectPr"):
            body.remove(child)


def _headings(doc, font, sizes, color="1A1A1A", align=None, h1_before=0, h1_after=18):
    _style(doc, "Heading 1", font=font, size=sizes[0], bold=True, italic=False, color=color,
           align=align, before=h1_before, after=h1_after, keep_next=True)
    for level, size in zip((2, 3, 4), sizes[1:]):
        _style(doc, f"Heading {level}", font=font, size=size, bold=True, italic=False, color=color,
               before=12, after=6, keep_next=True)


def build_plain():
    doc = Document()
    _page(doc, 21.0, 29.7, 2.5, 2.5, 3.0, 3.0)
    _style(doc, "Normal", font="Times New Roman", size=12, after=6, line=Pt(20),
           line_rule=WD_LINE_SPACING.EXACTLY)
    _headings(doc, "Times New Roman", (16, 14, 13, 12), align=WD_ALIGN_PARAGRAPH.CENTER)
    return doc


def build_novel_a5():
    doc = Document()
    s = _page(doc, 14.8, 21.0, 2.0, 2.0, 1.9, 1.9, footer_distance=0.9)
    _style(doc, "Normal", font="Georgia", size=11, before=0, after=0, line=1.3,
           align=WD_ALIGN_PARAGRAPH.JUSTIFY, indent=0.6)
    _headings(doc, "Georgia", (17, 13, 12, 11), align=WD_ALIGN_PARAGRAPH.CENTER, h1_before=48, h1_after=24)
    # Headings never take the body's first-line indent.
    for level in (1, 2, 3, 4):
        doc.styles[f"Heading {level}"].paragraph_format.first_line_indent = Cm(0)
    _page_number_footer(s, "Georgia", 9)
    return doc


def build_screen():
    doc = Document()
    _page(doc, 21.0, 29.7, 2.2, 2.2, 2.5, 2.5)
    _style(doc, "Normal", font="Segoe UI", size=11.5, before=0, after=10, line=1.5,
           align=WD_ALIGN_PARAGRAPH.LEFT, indent=0)
    _headings(doc, "Segoe UI Semibold", (20, 15, 13, 12), color="1B365D",
              align=WD_ALIGN_PARAGRAPH.LEFT, h1_before=0, h1_after=14)
    return doc


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, build in (("plain", build_plain), ("novel-a5", build_novel_a5), ("screen", build_screen)):
        doc = build()
        _clear_body(doc)
        doc.save(OUT / f"{name}.docx")
        print("wrote", name)
    (OUT / "index.json").write_text(json.dumps(INDEX, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote index.json")


if __name__ == "__main__":
    main()
