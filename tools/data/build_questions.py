"""questions_raw.json (+ danh sách câu điểm liệt nếu có) → app/data/questions.json, chép ảnh vào app/data/img/.

Danh sách điểm liệt: tools/data/critical.json = {"source": "...", "ids": [60 số câu]} (Phụ lục III, Công văn 2262/CSGT-P5).
Chưa có file này → mọi câu critical = false và in cảnh báo.

Dùng: python -E -P tools/data/build_questions.py
"""
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
OUT = HERE / "out"
APP_DATA = ROOT / "app" / "data"

CHAPTERS = [
    {"id": 1, "name": "Quy định chung và quy tắc giao thông đường bộ"},
    {"id": 2, "name": "Văn hóa giao thông, đạo đức người lái xe, kỹ năng PCCC và cứu hộ, cứu nạn"},
    {"id": 3, "name": "Kỹ thuật lái xe"},
    {"id": 4, "name": "Cấu tạo và sửa chữa"},
    {"id": 5, "name": "Báo hiệu đường bộ"},
    {"id": 6, "name": "Giải thế sa hình và kỹ năng xử lý tình huống giao thông"},
]


def main():
    qs = json.loads((OUT / "questions_raw.json").read_text(encoding="utf-8"))
    crit_file = HERE / "critical.json"
    crit = set()
    if crit_file.exists():
        c = json.loads(crit_file.read_text(encoding="utf-8"))
        crit = set(c["ids"])
        if len(crit) != 60 or not all(1 <= i <= 600 for i in crit):
            sys.exit(f"critical.json phải có đúng 60 số câu khác nhau trong 1..600 (đang có {len(crit)})")
    else:
        print("⚠ Chưa có tools/data/critical.json — chưa đánh dấu câu điểm liệt")

    for q in qs:
        q["critical"] = q["id"] in crit
        assert q["answer"] is not None and 0 <= q["answer"] < len(q["options"]), q["id"]

    img_dir = APP_DATA / "img"
    if img_dir.exists():
        shutil.rmtree(img_dir)
    img_dir.mkdir(parents=True)
    n_img = 0
    for q in qs:
        if q["image"]:
            shutil.copy2(OUT / q["image"], img_dir / Path(q["image"]).name)
            n_img += 1

    out = {
        "source": "Bộ 600 câu hỏi dùng cho sát hạch lái xe cơ giới đường bộ — Cục Cảnh sát giao thông, 2025 "
                  "(Công văn 2262/CSGT-P5 ngày 07/05/2025, áp dụng từ 01/6/2025)",
        "chapters": CHAPTERS,
        "questions": qs,
    }
    (APP_DATA / "questions.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = (APP_DATA / "questions.json").stat().st_size
    print(f"Ghi app/data/questions.json: {len(qs)} câu, {sum(q['critical'] for q in qs)} câu điểm liệt, "
          f"{n_img} ảnh, {size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
