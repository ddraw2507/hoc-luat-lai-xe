"""Tách văn bản hợp nhất Luật 36/2024/QH15 (55/VBHN-VPQH, PDF có lớp chữ) thành các Điều.

Quy ước trong PDF (đo từ file thật):
  - chữ thân bài cỡ 14; chú thích hợp nhất ở chân trang cỡ 12; số chú thích là chữ nhỏ (8–9) → bỏ.
  - dòng đầu đoạn thụt vào (x0 ≈ 113), dòng nối tiếp x0 ≈ 85; tiêu đề Chương/Mục căn giữa.
  - tiêu đề Điều in đậm: "Điều N. Tên điều".
  - số trang cỡ 13 ở đầu trang.

Dùng: python -E -P tools/data/law_parse.py <pdf> <out.json>
"""
import html
import json
import re
import sys
import unicodedata

import fitz  # PyMuPDF

BODY_MIN = 13.3
INDENT_X = 100
CENTER_X = 150
RE_ARTICLE = re.compile(r"^Điều\s+(\d+)\.\s*(.*)$")
RE_CHAPTER = re.compile(r"^Chương\s+([IVXLC]+)\s*$")
RE_SECTION = re.compile(r"^Mục\s+(\d+)\s*$")


def nfc(s):
    return unicodedata.normalize("NFC", s)


def iter_lines(doc):
    """Trả về từng dòng thân bài: (x0, [(text, bold, italic), ...])."""
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                spans = [s for s in line["spans"] if s["text"]]
                if not spans:
                    continue
                y0 = line["bbox"][1]
                txt = "".join(s["text"] for s in spans).strip()
                if y0 < 50 and txt.isdigit():
                    continue  # số trang
                keep = []
                for s in spans:
                    if s["size"] < BODY_MIN or (s["flags"] & 1):
                        continue  # chú thích chân trang / số chú thích
                    keep.append((nfc(s["text"]), bool(s["flags"] & 16), bool(s["flags"] & 2)))
                if keep and "".join(k[0] for k in keep).strip():
                    yield line["bbox"][0], keep


def paragraphs(doc):
    """Gộp các dòng thành đoạn: đoạn mới khi dòng thụt đầu dòng hoặc căn giữa."""
    cur = None
    for x0, spans in iter_lines(doc):
        starts = x0 >= INDENT_X
        if cur is None or starts:
            if cur:
                yield cur
            cur = {"centered": x0 >= CENTER_X, "spans": []}
        else:
            # dòng nối tiếp: chèn khoảng trắng nếu cần
            if cur["spans"] and not cur["spans"][-1][0].endswith(" "):
                cur["spans"].append((" ", False, False))
        cur["spans"].extend(spans)
    if cur:
        yield cur


def plain(par):
    return re.sub(r"\s+", " ", "".join(t for t, _, _ in par["spans"])).strip()


def to_html(par):
    """Đoạn → HTML (chỉ <b>, <i>), gộp các span liền nhau cùng kiểu."""
    out, buf, style = [], "", (False, False)
    for t, b, i in par["spans"] + [("", None, None)]:
        st = (b, i)
        if st != style or b is None:
            if buf.strip():
                s = html.escape(re.sub(r"\s+", " ", buf))
                if style[1]:
                    s = f"<i>{s}</i>"
                if style[0]:
                    s = f"<b>{s}</b>"
                out.append(s)
            elif buf:
                out.append(" ")
            buf, style = "", st
        buf += t
    return re.sub(r"\s+", " ", "".join(out)).strip()


def parse(pdf_path):
    doc = fitz.open(pdf_path)
    articles, chapter, chapter_title, pending = [], None, None, None
    art = None
    for par in paragraphs(doc):
        text = plain(par)
        m_ch = RE_CHAPTER.match(text)
        if m_ch:
            chapter, pending = m_ch.group(1), "chapter"
            continue
        if pending == "chapter" and par["centered"]:
            chapter_title, pending = text, None
            continue
        if RE_SECTION.match(text):
            pending = "section"
            continue
        if pending == "section" and par["centered"]:
            pending = None
            continue
        m_art = RE_ARTICLE.match(text)
        if m_art and par["spans"][0][1]:  # tiêu đề Điều in đậm
            art = {
                "no": int(m_art.group(1)),
                "title": m_art.group(2).strip(),
                "chapter": chapter,
                "chapterTitle": chapter_title,
                "paras": [],
            }
            articles.append(art)
            continue
        if art is not None and not par["centered"]:
            art["paras"].append({"text": text, "html": to_html(par)})
    return articles


if __name__ == "__main__":
    arts = parse(sys.argv[1])
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(arts, f, ensure_ascii=False, indent=1)
    nos = [a["no"] for a in arts]
    missing = sorted(set(range(1, max(nos) + 1)) - set(nos))
    print(f"Điều: {len(arts)} (1..{max(nos)}), thiếu: {missing}, trùng: {len(nos) - len(set(nos))}")
    for a in arts:
        print(f"  Đ{a['no']:>2} [{a['chapter']}] {a['title'][:70]}  ({len(a['paras'])} đoạn)")
