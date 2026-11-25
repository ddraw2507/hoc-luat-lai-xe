// Node 24 coi `node --test tools/app/` là đường dẫn module, nên cần index.js để lệnh đó chạy được.
// Nạp các file test thật (ES module) bằng import() động.
import('./exam.test.mjs');
import('./logic.test.mjs');
