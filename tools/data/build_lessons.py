"""Ghép mục lục bài học (lesson_outline.json) với các Điều luật đã tách (law_articles.json) → lessons.json cho app.

Phần "luat": mỗi bài ứng với 1 Điều, tìm theo tên Điều (so khớp mờ); ghi đè thủ công trong OVERRIDE khi tên bài
của trường khác tên Điều. Các phần khác chưa có nguồn → html = null (app hiện "Sắp có").

Dùng: python -E -P tools/data/build_lessons.py
"""
import difflib
import json
import re
import sys
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"
SOURCE = "Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15 — văn bản hợp nhất 55/VBHN-VPQH (đã cập nhật sửa đổi theo Luật 118/2025/QH15, hiệu lực 01/7/2026)"

# Tên bài của trường khác tên Điều → chỉ định Điều trực tiếp.
OVERRIDE = {
    ("luat", "3.1"): 35,  # "Điều kiện xe ô tô tham gia…" = Điều 35 "Điều kiện phương tiện tham gia giao thông đường bộ"
}
MIN_RATIO = 0.85


def norm(s):
    s = unicodedata.normalize("NFC", s).lower()
    s = s.replace("hoá", "hóa").replace("khoẻ", "khỏe")
    return re.sub(r"[^\w]+", " ", s).strip()


def article_html(art):
    parts = [f"<h4>Điều {art['no']}. {art['title']}</h4>"]
    for p in art["paras"]:
        if not re.search(r"\w", p["text"]):
            continue
        parts.append(f"<p>{p['html']}</p>")
    return "\n".join(parts)


def main():
    outline = json.loads((HERE / "lesson_outline.json").read_text(encoding="utf-8"))
    arts = json.loads((OUT / "law_articles.json").read_text(encoding="utf-8"))
    by_no = {a["no"]: a for a in arts}
    titles = {norm(a["title"]): a["no"] for a in arts}

    report, used, problems = [], {}, []
    parts_out = []
    for part in outline["parts"]:
        groups_out = []
        for g in part["groups"]:
            lessons = []
            for num, title in g["lessons"]:
                lid = f"{part['id']}-{num.replace('.', '-')}"
                lesson = {"id": lid, "num": num, "title": title, "source": None, "html": None}
                if part["id"] == "luat":
                    no = OVERRIDE.get((part["id"], num))
                    how = "chỉ định"
                    if no is None:
                        cand = difflib.get_close_matches(norm(title), titles.keys(), n=1, cutoff=0)
                        ratio = difflib.SequenceMatcher(None, norm(title), cand[0]).ratio()
                        no, how = titles[cand[0]], f"khớp {ratio:.2f}"
                        if ratio < MIN_RATIO:
                            problems.append(f"{num} '{title}' → Điều {no} '{by_no[no]['title']}' ({how})")
                    if no in used:
                        problems.append(f"Điều {no} dùng cho cả bài {used[no]} và {num}")
                    used[no] = num
                    art = by_no[no]
                    lesson["source"] = f"Điều {no}, {SOURCE}"
                    lesson["html"] = article_html(art)
                    report.append(f"  {num:>5} → Điều {no:>2} {art['title'][:60]}  [{how}]")
                lessons.append(lesson)
            groups_out.append({"title": g["title"], "lessons": lessons})
        parts_out.append({"id": part["id"], "title": part["title"], "source": part.get("source"), "groups": groups_out})

    out = {"parts": parts_out}
    (OUT / "lessons.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(len(g["lessons"]) for p in parts_out for g in p["groups"])
    filled = sum(1 for p in parts_out for g in p["groups"] for l in g["lessons"] if l["html"])
    print("\n".join(report))
    print(f"Bài: {total}, có nội dung: {filled}, chưa có: {total - filled}")
    if problems:
        print("CẦN XEM:\n  " + "\n  ".join(problems))
        sys.exit(1)
    print("KẾT LUẬN: ĐẠT — mọi bài phần Luật khớp đúng 1 Điều, không Điều nào dùng hai lần")


if __name__ == "__main__":
    main()
