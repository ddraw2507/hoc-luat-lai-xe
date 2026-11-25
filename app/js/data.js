// Tải 3 file dữ liệu (đường dẫn tương đối, SW phục vụ từ cache khi offline).
let cache = null;

async function getJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export async function loadData() {
  if (cache) return cache;
  const [q, l, e] = await Promise.all([
    getJson('data/questions.json'), getJson('data/lessons.json'), getJson('data/exam.json')]);
  const byId = new Map(q.questions.map((x) => [x.id, x]));
  const lessons = [];
  for (const p of l.parts) for (const g of p.groups) for (const ls of g.lessons) lessons.push(ls);
  cache = { questions: q.questions, chapters: q.chapters, source: q.source, byId, parts: l.parts, lessons, exam: e };
  return cache;
}

export function currentStructure(data, settings) {
  const id = settings.examId || data.exam.default;
  return data.exam.structures.find((s) => s.id === id) || data.exam.structures[0];
}
