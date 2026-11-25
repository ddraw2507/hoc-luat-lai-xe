// Router theo hash. Mỗi view là hàm (container, params) => cleanup? (có thể async).
const routes = [];
let cleanup = null;
let token = 0;

export function route(pattern, view, tab) {
  // pattern như "/hoc/:id"
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ re, keys, view, tab });
}

export function go(path) { location.hash = '#' + path; }

export function currentPath() { return (location.hash.slice(1) || '/').split('?')[0]; }

export async function resolve(container) {
  const path = currentPath();
  const my = ++token;
  if (cleanup) { try { cleanup(); } catch { /* */ } cleanup = null; }
  for (const r of routes) {
    const m = r.re.exec(path);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    container.replaceChildren();
    window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent('routechange', { detail: { tab: r.tab } }));
    try {
      const c = await r.view(container, params);
      if (my === token) cleanup = typeof c === 'function' ? c : null;
      else if (typeof c === 'function') c();
    } catch (err) {
      const p = document.createElement('p');
      p.className = 'card';
      p.textContent = 'Có lỗi: ' + err.message;
      container.replaceChildren(p);
    }
    return;
  }
  go('/');
}

export function start(container) {
  window.addEventListener('hashchange', () => resolve(container));
  return resolve(container);
}
