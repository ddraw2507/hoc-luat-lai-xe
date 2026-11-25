"""Tách bộ 600 câu hỏi (PDF của Cục CSGT, xuất từ Word) → questions_raw.json + ảnh minh hoạ.

Quy ước trong PDF (đo từ file thật):
  - "Câu N. …" in đậm (flags & 16), cỡ 14; nội dung câu hỏi in đậm, các ý "1. …", "2. …" chữ thường.
  - Đáp án đúng: dòng của ý đúng có gạch chân — hình chữ nhật tô đen cao ≤ 2.5 pt nằm ngay dưới dòng chữ.
  - Ảnh minh hoạ nằm giữa câu hỏi và các ý; một câu có thể ghép từ nhiều ảnh → render vùng hợp của các ảnh.
  - Chương theo số câu: I 1–180, II 181–205, III 206–263, IV 264–300, V 301–485, VI 486–600 (Lời nói đầu).

Dùng: python -E -P tools/data/q600_parse.py <pdf> <out_dir>
Ghi: <out_dir>/questions_raw.json, <out_dir>/img/qNNN.webp
"""
import io
import json
import re
import sys
import unicodedata
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

CHAPTERS = [
    (1, "Quy định chung và quy tắc giao thông đường bộ", 1, 180),
    (2, "Văn hóa giao thông, đạo đức người lái xe, kỹ năng phòng cháy, chữa cháy và cứu hộ, cứu nạn", 181, 205),
    (3, "Kỹ thuật lái xe", 206, 263),
    (4, "Cấu tạo và sửa chữa", 264, 300),
    (5, "Báo hiệu đường bộ", 301, 485),
    (6, "Giải thế sa hình và kỹ năng xử lý tình huống giao thông", 486, 600),
]
RE_Q = re.compile(r"^Câu\s+(\d+)\s*[.:]\s*(.*)$")  # câu 507 viết "Câu 507:"
RE_OPT_NUM = re.compile(r"^[1-4]\.$")
RE_OPT = re.compile(r"^([1-4])\s*\.\s*(.*)$")
RE_CHAPTER_HEAD = re.compile(r"^CHƯƠNG\s+[IVX]+\b")
# Lỗi tách chữ có sẵn trong PDF gốc (tìm bằng cách quét "âm tiết" không có nguyên âm) → sửa đích danh.
TEXT_FIXES = {3: [("đường b ộ", "đường bộ")]}
IMG_ZOOM = 2.0
IMG_MAX_W = 900
WEBP_Q = 78


def nfc(s):
    return unicodedata.normalize("NFC", s)


def chapter_of(n):
    for cid, _, a, b in CHAPTERS:
        if a <= n <= b:
            return cid
    raise ValueError(n)


def page_rows(page):
    """Gộp các dòng có cùng đường chân chữ thành một hàng (PDF đôi khi tách 1 ký tự có dấu ra dòng riêng)."""
    lines = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            spans = [s for s in l["spans"] if s["text"].strip()]
            if not spans:
                continue
            lines.append({
                "x0": l["bbox"][0], "y0": l["bbox"][1], "x1": l["bbox"][2], "y1": l["bbox"][3],
                "base": spans[0]["origin"][1],
                "spans": [(nfc(s["text"]), s["bbox"][0], s["bbox"][2], bool(s["flags"] & 16), s["size"]) for s in spans],
            })
    lines.sort(key=lambda r: (round(r["base"]), r["x0"]))
    rows = []
    for ln in lines:
        if rows and abs(rows[-1]["base"] - ln["base"]) < 3:
            r = rows[-1]
            r["spans"] += ln["spans"]
            r["x0"], r["x1"] = min(r["x0"], ln["x0"]), max(r["x1"], ln["x1"])
            r["y0"], r["y1"] = min(r["y0"], ln["y0"]), max(r["y1"], ln["y1"])
        else:
            rows.append(dict(ln))
    for r in rows:
        r["spans"].sort(key=lambda s: s[1])
        text, last_x1 = "", None
        for t, x0, x1, _, _ in r["spans"]:
            if last_x1 is not None and x0 - last_x1 > 1.5 and not text.endswith(" ") and not t.startswith(" "):
                text += " "
            text += t
            last_x1 = x1
        r["text"] = re.sub(r"\s+", " ", text).strip()
        r["bold"] = r["spans"][0][3]
        r["size"] = max(s[4] for s in r["spans"])
    return rows


def split_options(page, row):
    """Một hàng chứa nhiều ý ("1. Biển 1.      2. Biển 2.") → [(số, text, rect)], cắt theo vị trí từ "N." trên hàng."""
    words = [w for w in page.get_text("words") if abs((w[1] + w[3]) / 2 - (row["y0"] + row["y1"]) / 2) < 4]
    words.sort(key=lambda w: w[0])
    # "N." chỉ là đầu ý khi là từ đầu hàng hoặc cách từ trước một khoảng lớn ("Biển 1." không phải đầu ý)
    starts = [i for i, w in enumerate(words)
              if RE_OPT_NUM.match(nfc(w[4])) and (i == 0 or w[0] - words[i - 1][2] > 12)]
    out = []
    for k, i in enumerate(starts):
        j = starts[k + 1] if k + 1 < len(starts) else len(words)
        seg = words[i:j]
        x1 = words[j][0] - 1 if j < len(words) else row["x1"]
        out.append((int(seg[0][4][0]), " ".join(nfc(w[4]) for w in seg[1:]), fitz.Rect(seg[0][0], row["y0"], x1, row["y1"])))
    return out


def underlines(page):
    out = []
    for dr in page.get_drawings():
        r = dr["rect"]
        fill = dr.get("fill")
        if fill is not None and max(fill) < 0.2 and r.height <= 2.5 and r.width > 3:
            out.append(r)
    return out


def image_rects(page):
    rects = []
    for info in page.get_image_info():
        r = fitz.Rect(info["bbox"])
        if r.width > 15 and r.height > 15:
            rects.append(r)
    return rects


def render_clip(page, rect, path):
    pix = page.get_pixmap(matrix=fitz.Matrix(IMG_ZOOM, IMG_ZOOM), clip=rect, alpha=False)
    im = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    if im.width > IMG_MAX_W:
        im = im.resize((IMG_MAX_W, round(im.height * IMG_MAX_W / im.width)), Image.LANCZOS)
    im.save(path, "WEBP", quality=WEBP_Q, method=6)
    return im.size


def parse(pdf_path, out_dir):
    doc = fitz.open(pdf_path)
    img_dir = Path(out_dir) / "img"
    img_dir.mkdir(parents=True, exist_ok=True)

    questions = []   # mỗi câu: text, options[{text, rows[(page, rect)]}], images[(page, rect)]
    problems_early = []
    cur = None
    state = None     # "q" (đang đọc câu hỏi) | "opt"
    for pno, page in enumerate(doc):
        if pno < 3:
            continue  # bìa, ban biên soạn, lời nói đầu
        rows = page_rows(page)
        ul = underlines(page)
        events = [("row", r["y0"], r) for r in rows] + [("img", r.y0, r) for r in image_rects(page)]
        events.sort(key=lambda e: e[1])
        for kind, _, obj in events:
            if kind == "img":
                if cur is not None:
                    cur["images"].append((pno, obj))
                continue
            r = obj
            t = r["text"]
            if r["y0"] < 45 and t.isdigit():
                continue  # số trang
            if RE_CHAPTER_HEAD.match(t):
                state = "chapter"
                continue
            if state == "chapter" and t.isupper():
                continue  # dòng 2 của tiêu đề chương
            m = RE_Q.match(t)
            if m and r["bold"]:
                cur = {"id": int(m.group(1)), "text": m.group(2), "options": [], "images": [], "pages": {pno}}
                questions.append(cur)
                state = "q"
                continue
            if cur is None:
                continue
            cur["pages"].add(pno)
            rr = fitz.Rect(r["x0"], r["y0"], r["x1"], r["y1"])

            def ul_len(rect):
                """Độ dài gạch chân nằm ngay dưới vùng chữ rect."""
                return sum(min(u.x1, rect.x1) - max(u.x0, rect.x0) for u in ul
                           if rect.y1 - 4 <= u.y0 <= rect.y1 + 2.5 and u.x1 > rect.x0 and u.x0 < rect.x1)

            mo = RE_OPT.match(t)
            parts = split_options(page, r) if mo and not r["bold"] else []
            if mo and not r["bold"] and len(parts) < 2:
                parts = [(int(mo.group(1)), mo.group(2), rr)]
            have = {o["num"] for o in cur["options"]}
            # nhận hàng ý: ý kế tiếp theo thứ tự, hoặc hàng lưới nhiều ý ("1. … 3. …" / "2. … 4. …" — câu 301, 302)
            if parts and not any(p[0] in have for p in parts) and (len(parts) > 1 or parts[0][0] == len(have) + 1):
                for num, text, prect in parts:
                    cur["options"].append({"num": num, "text": text, "rows": [(pno, prect)], "ul": ul_len(prect)})
                state = "opt"
            elif state == "q":
                cur["text"] += " " + t
            elif state == "opt":
                cur["options"][-1]["text"] += " " + t
                cur["options"][-1]["rows"].append((pno, rr))
                cur["options"][-1]["ul"] += ul_len(rr)

    # --- hậu xử lý, kiểm tra, ảnh ---
    out, problems = [], list(problems_early)
    for q in questions:
        qtext = re.sub(r"\s+", " ", q["text"]).strip()
        q["options"].sort(key=lambda o: o["num"])
        if [o["num"] for o in q["options"]] != list(range(1, len(q["options"]) + 1)):
            problems.append(f"Câu {q['id']}: số thứ tự ý {[o['num'] for o in q['options']]}")
        opts = [re.sub(r"\s+", " ", o["text"]).strip() for o in q["options"]]
        for bad, good in TEXT_FIXES.get(q["id"], []):
            hits = sum(s.count(bad) for s in [qtext] + opts)
            if hits != 1:
                problems.append(f"Câu {q['id']}: sửa chữ '{bad}' khớp {hits} chỗ (cần đúng 1)")
            qtext = qtext.replace(bad, good)
            opts = [s.replace(bad, good) for s in opts]
        ul = [o["ul"] for o in q["options"]]
        marked = [i for i, v in enumerate(ul) if v > 8]
        if len(marked) != 1:
            problems.append(f"Câu {q['id']}: số ý gạch chân = {len(marked)} (độ dài {[round(v) for v in ul]})")
        if not 2 <= len(opts) <= 4:
            problems.append(f"Câu {q['id']}: {len(opts)} ý")
        image = None
        if q["images"]:
            pages = sorted({p for p, _ in q["images"]})
            if len(pages) > 1:
                problems.append(f"Câu {q['id']}: ảnh nằm trên {len(pages)} trang {pages} — lấy trang đầu")
            pno = pages[0]
            rect = fitz.Rect()
            for p, r in q["images"]:
                if p == pno:
                    rect |= r
            name = f"q{q['id']:03d}.webp"
            w, h = render_clip(doc[pno], rect, img_dir / name)
            image = f"img/{name}"
        out.append({
            "id": q["id"], "chapter": chapter_of(q["id"]), "text": qtext, "options": opts,
            "answer": marked[0] if len(marked) == 1 else None, "critical": False, "image": image,
        })

    ids = [q["id"] for q in out]
    missing = sorted(set(range(1, 601)) - set(ids))
    dup = len(ids) - len(set(ids))
    if missing or dup:
        problems.append(f"thiếu câu: {missing[:20]}{'…' if len(missing) > 20 else ''} ({len(missing)}), trùng: {dup}")
    return out, problems


if __name__ == "__main__":
    qs, problems = parse(sys.argv[1], sys.argv[2])
    Path(sys.argv[2], "questions_raw.json").write_text(json.dumps(qs, ensure_ascii=False, indent=1), encoding="utf-8")
    with_img = sum(1 for q in qs if q["image"])
    per_ch = {c[0]: sum(1 for q in qs if q["chapter"] == c[0]) for c in CHAPTERS}
    print(f"Câu: {len(qs)}, có ảnh: {with_img}, có đáp án: {sum(1 for q in qs if q['answer'] is not None)}")
    print("Theo chương:", per_ch)
    if problems:
        print(f"CẦN XEM ({len(problems)}):")
        for p in problems[:60]:
            print("  " + p)
        sys.exit(1)
    print("KẾT LUẬN: ĐẠT — đủ 600 câu, mỗi câu đúng 1 ý gạch chân, 2–4 ý")
