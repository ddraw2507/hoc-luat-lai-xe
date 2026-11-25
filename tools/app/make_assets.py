"""Tạo icon app và dữ liệu MẪU (chỉ khi file chưa tồn tại — không bao giờ ghi đè)."""
import json, os, random
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "app")
ROOT = os.path.normpath(ROOT)

def icon(size, path, maskable_pad=0.0):
    if os.path.exists(path):
        return
    s = size * 4
    im = Image.new("RGB", (s, s), (24, 90, 190))
    d = ImageDraw.Draw(im)
    c = s / 2
    r = s * (0.40 - maskable_pad)
    d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 255, 255))
    r2 = r * 0.84
    d.ellipse([c - r2, c - r2, c + r2, c + r2], fill=(214, 40, 40))
    r3 = r * 0.62
    d.ellipse([c - r3, c - r3, c + r3, c + r3], fill=(255, 255, 255))
    # mũi tên chữ "L" cách điệu: thanh ngang trong biển
    w = r3 * 0.38
    d.rounded_rectangle([c - r3 * 0.62, c - w / 2, c + r3 * 0.62, c + w / 2], radius=w / 2, fill=(24, 90, 190))
    d.polygon([(c + r3 * 0.2, c - r3 * 0.55), (c + r3 * 0.75, c), (c + r3 * 0.2, c + r3 * 0.55)], fill=(24, 90, 190))
    im.resize((size, size), Image.LANCZOS).save(path)

def placeholder_png(path, label):
    img = Image.new("RGB", (320, 200), (235, 240, 250))
    d = ImageDraw.Draw(img)
    d.rectangle([4, 4, 315, 195], outline=(24, 90, 190), width=4)
    d.ellipse([120, 40, 200, 120], outline=(214, 40, 40), width=8)
    d.text((130, 150), label, fill=(30, 30, 30))
    img.save(path)

def write_if_missing(path, obj):
    if os.path.exists(path):
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    return True

def main():
    os.makedirs(os.path.join(ROOT, "icons"), exist_ok=True)
    icon(192, os.path.join(ROOT, "icons", "icon-192.png"))
    icon(512, os.path.join(ROOT, "icons", "icon-512.png"))
    icon(180, os.path.join(ROOT, "icons", "apple-touch-icon.png"))

    data = os.path.join(ROOT, "data")
    qpath = os.path.join(data, "questions.json")
    if not os.path.exists(qpath):
        os.makedirs(os.path.join(data, "img"), exist_ok=True)
        chapters = [
            {"id": 1, "name": "Quy định chung và quy tắc giao thông đường bộ"},
            {"id": 2, "name": "Văn hoá giao thông và đạo đức người lái xe"},
            {"id": 3, "name": "Hệ thống biển báo hiệu đường bộ"},
        ]
        qs = []
        crit = {2, 5, 9}
        imgs = {10, 12}
        for i in range(1, 13):
            ch = 1 + (i - 1) // 4
            n_opt = 2 + (i % 3)
            q = {
                "id": i, "chapter": ch,
                "text": f"[MẪU] Câu hỏi số {i} của chương {ch}?",
                "options": [f"Ý trả lời {k + 1}" for k in range(n_opt)],
                "answer": i % n_opt,
                "critical": i in crit,
                "image": None,
            }
            if i in imgs:
                rel = f"img/q{i:03d}.png"
                placeholder_png(os.path.join(data, rel), f"MAU {i}")
                q["image"] = rel
            qs.append(q)
        write_if_missing(qpath, {"source": "[MẪU] Dữ liệu thử nghiệm", "chapters": chapters, "questions": qs})

    lpath = os.path.join(data, "lessons.json")
    def les(i, num, title, html):
        return {"id": i, "num": num, "title": title, "source": "[MẪU] Nguồn thử nghiệm", "html": html}
    body = ("<h3>Mục 1</h3><p>Đây là nội dung mẫu. Người lái xe phải chấp hành quy tắc giao thông. "
            "Khi tham gia giao thông cần quan sát, giữ khoảng cách an toàn, và nhường đường đúng quy định.</p>"
            "<ol><li>Ý thứ nhất</li><li>Ý thứ hai</li></ol><table><tr><th>Loại</th><th>Tốc độ</th></tr><tr><td>A</td><td>50</td></tr></table>")
    write_if_missing(lpath, {"parts": [
        {"id": "luat", "title": "Luật Trật tự, an toàn giao thông đường bộ", "groups": [
            {"title": "Chương 1. Quy định chung", "lessons": [
                les("luat-1-1", "1.1", "Phạm vi điều chỉnh", body),
                les("luat-1-2", "1.2", "Giải thích từ ngữ", body),
                les("luat-1-3", "1.3", "Nguyên tắc (sắp có)", None)]},
            {"title": "Chương 2. Quy tắc giao thông", "lessons": [
                les("luat-2-1", "2.1", "Quy tắc chung", body),
                les("luat-2-2", "2.2", "Tốc độ và khoảng cách", body)]}]},
        {"id": "bao", "title": "Biển báo và sa hình", "groups": [
            {"title": "Biển báo", "lessons": [
                les("bao-1-1", "1.1", "Biển cấm", body),
                les("bao-1-2", "1.2", "Biển nguy hiểm (sắp có)", None),
                les("bao-1-3", "1.3", "Biển hiệu lệnh", body)]}]}]})

    write_if_missing(os.path.join(data, "exam.json"), {"default": "B-2025", "structures": [
        {"id": "B-2025", "label": "Hạng B — hiện hành", "note": "Đề 30 câu, 20 phút.",
         "count": 30, "minutes": 20, "passScore": 27, "criticalCount": 1, "perChapter": None},
        {"id": "B-2027", "label": "Hạng B — từ 01/3/2027", "note": "Đề 50 câu, 33 phút.",
         "count": 50, "minutes": 33, "passScore": 45, "criticalCount": 1, "perChapter": None}]})
    print("assets ok")

main()
