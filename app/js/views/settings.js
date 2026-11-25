import { h, toast, confirmBox } from '../util.js';
import { loadData, currentStructure } from '../data.js';
import * as store from '../store.js';
import * as tts from '../tts.js';

export function applyFont() {
  document.documentElement.style.setProperty('--fs', store.get().settings.fontSize + 'px');
}

export async function settings(el) {
  const data = await loadData();
  const s = store.get();
  const set = (fn) => store.update((x) => fn(x.settings));
  const field = (label, control, hint) => h('label', { class: 'field' }, h('span', {}, label), control, hint ? h('span', { class: 'sub' }, hint) : null);

  const examSel = h('select', { onchange: (e) => set((st) => { st.examId = e.target.value; }) },
    data.exam.structures.map((x) => h('option', { value: x.id, selected: x.id === currentStructure(data, s.settings).id ? true : null }, x.label)));
  const dateIn = h('input', { type: 'date', value: s.settings.examDate || '', onchange: (e) => set((st) => { st.examDate = e.target.value; }) });
  const fsLbl = h('b', {}, s.settings.fontSize + ' px');
  const fs = h('input', { type: 'range', min: '15', max: '22', step: '1', value: String(s.settings.fontSize),
    oninput: (e) => { set((st) => { st.fontSize = parseInt(e.target.value, 10); }); fsLbl.textContent = e.target.value + ' px'; applyFont(); } });
  const rateLbl = h('b', {}, '×' + s.settings.rate.toFixed(1));
  const rate = h('input', { type: 'range', min: '0.8', max: '1.4', step: '0.1', value: String(s.settings.rate),
    oninput: (e) => { set((st) => { st.rate = parseFloat(e.target.value); }); rateLbl.textContent = '×' + parseFloat(e.target.value).toFixed(1); } });

  const voiceSel = h('select', { onchange: (e) => set((st) => { st.voice = e.target.value; }) });
  const voiceHint = h('span', { class: 'sub' });
  const fillVoices = (vs) => {
    voiceSel.replaceChildren(h('option', { value: '' }, 'Tự động'), ...vs.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === store.get().settings.voice ? true : null }, `${v.name} (${v.lang})`)));
    voiceHint.textContent = !tts.supported() ? 'Thiết bị không hỗ trợ đọc to.'
      : vs.length ? '' : 'Chưa thấy giọng tiếng Việt. Vào Cài đặt iPhone → Trợ năng → Nội dung đã nói → Giọng nói → Tiếng Việt để tải giọng.';
  };
  const offVoices = tts.onVoices(fillVoices);
  const testBtn = h('button', { class: 'btn small', type: 'button', onclick: () => tts.speak('Xin chào, đây là giọng đọc thử.', { rate: store.get().settings.rate, voiceURI: store.get().settings.voice }) }, '🔊 Đọc thử');

  const box = h('textarea', { rows: '4', placeholder: 'Dán JSON tiến độ vào đây rồi bấm Nhập', 'aria-label': 'JSON tiến độ' });
  const exportBtn = h('button', { class: 'btn', onclick: () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'tien-do-luat-lai-xe.json' });
    document.body.append(a); a.click(); a.remove();
  } }, 'Tải file tiến độ');
  const copyBtn = h('button', { class: 'btn', onclick: async () => {
    box.value = store.exportJson();
    try { await navigator.clipboard.writeText(box.value); toast('Đã sao chép'); } catch { box.select(); toast('Hãy chép thủ công'); }
  } }, 'Hiện / sao chép JSON');
  const importBtn = h('button', { class: 'btn', onclick: async () => {
    let obj;
    try { obj = JSON.parse(box.value); if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('bad'); } catch { toast('JSON không hợp lệ'); return; }
    if (await confirmBox('Nhập sẽ thay thế toàn bộ tiến độ hiện tại. Tiếp tục?', 'Nhập')) { store.replaceAll(obj); applyFont(); toast('Đã nhập tiến độ'); location.hash = '#/'; }
  } }, 'Nhập');
  const resetBtn = h('button', { class: 'btn danger', onclick: async () => {
    if (!(await confirmBox('Xoá toàn bộ tiến độ học và lịch sử thi trên máy này?', 'Tiếp tục'))) return;
    if (!(await confirmBox('Chắc chắn xoá? Không thể hoàn tác.', 'Xoá hết'))) return;
    store.reset(); applyFont(); toast('Đã xoá tiến độ'); location.hash = '#/';
  } }, 'Xoá toàn bộ tiến độ');

  el.append(h('h1', {}, 'Cài đặt'),
    h('div', { class: 'card' },
      field('Cấu trúc đề mặc định', examSel),
      field('Ngày thi dự kiến', dateIn),
      field(['Cỡ chữ ', fsLbl], fs),
      field(['Tốc độ đọc ', rateLbl], rate),
      field('Giọng đọc', voiceSel, null), voiceHint, testBtn),
    h('h2', {}, 'Tiến độ'),
    h('div', { class: 'card' }, h('div', { class: 'row wrap' }, exportBtn, copyBtn), box, h('div', { class: 'row' }, importBtn), h('hr'), resetBtn),
    h('h2', {}, 'Giới thiệu'),
    h('div', { class: 'card about' },
      h('p', {}, 'Nguồn dữ liệu: ' + data.source),
      h('p', {}, 'App ôn tập cá nhân, không thay thế giờ học bắt buộc trên hệ thống của cơ sở đào tạo.'),
      h('p', {}, h('b', {}, 'Cài lên iPhone: '), 'mở bằng Safari → nút Chia sẻ → Thêm vào MH chính. Sau lần mở đầu app chạy offline.')));

  return () => { offVoices(); tts.stop(); };
}
