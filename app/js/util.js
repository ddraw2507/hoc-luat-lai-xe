// Tiện ích dùng chung: dựng DOM, bỏ dấu tiếng Việt, lọc HTML bài học.

/** h('div', {class:'x', onclick:fn}, child, 'text', [..]) -> HTMLElement */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}

/** Bỏ dấu tiếng Việt + chữ thường, để tìm kiếm không phân biệt dấu. */
export function fold(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
}

const ALLOWED = new Set(['P', 'OL', 'UL', 'LI', 'B', 'I', 'H3', 'H4', 'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH', 'IMG', 'BR']);

function safeSrc(src) {
  if (!src) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('/')) return null;
  return src;
}

/** Lọc HTML theo whitelist: thẻ lạ bị bỏ (giữ chữ bên trong), mọi thuộc tính bị bỏ trừ src/alt của <img>. */
export function sanitize(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html || '');
  const out = document.createDocumentFragment();
  const walk = (node, into) => {
    for (const n of Array.from(node.childNodes)) {
      if (n.nodeType === 3) { into.append(document.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') continue;
      if (!ALLOWED.has(tag)) { walk(n, into); continue; }
      const copy = document.createElement(tag.toLowerCase());
      if (tag === 'IMG') {
        const src = safeSrc(n.getAttribute('src'));
        if (!src) continue;
        copy.setAttribute('src', src);
        copy.setAttribute('alt', n.getAttribute('alt') || '');
        copy.setAttribute('loading', 'lazy');
      } else walk(n, copy);
      into.append(copy);
    }
  };
  walk(tpl.content, out);
  return out;
}

export function fmtDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

export function toast(msg, onTap) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  t.onclick = () => { t.hidden = true; if (onTap) onTap(); };
  if (!onTap) setTimeout(() => { t.hidden = true; }, 2500);
}

/** Hộp xác nhận dạng bottom sheet. Trả Promise<boolean>. */
export function confirmBox(message, okLabel = 'Đồng ý', cancelLabel = 'Huỷ') {
  return new Promise((resolve) => {
    const done = (v) => { overlay.remove(); resolve(v); };
    const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'sheet' },
        h('p', { class: 'sheet-msg' }, message),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => done(false) }, cancelLabel),
          h('button', { class: 'btn primary', onclick: () => done(true) }, okLabel))));
    document.body.append(overlay);
  });
}

/** Bottom sheet chứa nội dung tuỳ ý. Trả hàm đóng. */
export function sheet(title, content) {
  const close = () => overlay.remove();
  const overlay = h('div', { class: 'overlay', onclick: (e) => { if (e.target === overlay) close(); } },
    h('div', { class: 'sheet tall' },
      h('div', { class: 'sheet-head' }, h('b', {}, title), h('button', { class: 'btn small', onclick: close }, 'Đóng')),
      content));
  document.body.append(overlay);
  return close;
}
