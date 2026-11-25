"""Chọn các cặp "biển báo ↔ ý nghĩa" cho trò Ghép biển báo, từ app/data/questions.json → app/data/signs.json.

Điều kiện một câu được chọn (chương 5 – Báo hiệu đường bộ):
  - có ảnh, tỉ lệ ảnh 0.55–1.8 (một biển hoặc một cụm nhỏ; ảnh dải "Biển 1 / Biển 2 / Biển 3" rộng > 1.8 bị loại);
  - đáp án đúng là một câu mô tả ý nghĩa/cách xử lý (≥ 12 ký tự), không phải "Biển 1.", "Cả hai…", "Có.", "Bắt buộc.", "Vạch 3."…
  - ý nghĩa không trùng nhau.
Kết quả tự kiểm: ≥ 12 cặp, ảnh tồn tại.

Dùng: python -E -P tools/data/build_signs.py
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "app" / "data"
NOT_MEANING = re.compile(r"^(Biển \d|Vạch \d|Cả |Không|Hướng|Xe |Chỉ |Được|Đúng|Sai|Ý \d|Có\b|Bắt buộc)")


def main():
    qs = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))["questions"]
    pairs, seen = [], set()
    for q in qs:
        if q["chapter"] != 5 or not q["image"]:
            continue
        ans = q["options"][q["answer"]].strip()
        with Image.open(DATA / q["image"]) as im:
            ar = im.width / im.height
        if not 0.55 < ar < 1.8 or NOT_MEANING.match(ans) or len(ans) < 12 or ans in seen:
            continue
        seen.add(ans)
        pairs.append({"id": q["id"], "image": q["image"], "meaning": ans})
    if len(pairs) < 12:
        sys.exit(f"KẾT LUẬN: KHÔNG ĐẠT — chỉ có {len(pairs)} cặp (cần ≥ 12)")
    out = {"source": "Chọn từ chương V bộ 600 câu (câu hỏi một biển – đáp án là ý nghĩa)", "pairs": pairs}
    (DATA / "signs.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Ghi app/data/signs.json: {len(pairs)} cặp — câu {[p['id'] for p in pairs]}")
    print("KẾT LUẬN: ĐẠT")


if __name__ == "__main__":
    main()
