// ============================================================
// roster.test.js — đối chiếu bản PORT (roster.js) với code GỐC trong index.html.
// Chạy: node roster.test.js   (phải 0 lệch)
//
// Ý tưởng: trích nguyên các hàm gốc (parseDate..sessionNumberOf) từ index.html,
// chạy trong sandbox, rồi so từng ngày với bản port trên cùng một CONFIG thật.
// ============================================================
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseConfig,
  parseDate,
  addDays,
  fmtISO,
  isSchoolSession as portIsSchool,
  sessionNumberOf as portSessionNo,
  personForSession as portPerson,
} from "./roster.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");
const cfg = parseConfig(html);

// --- Trích code gốc: từ "function parseDate(" tới trước "function upcomingSessions" ---
const from = html.indexOf("function parseDate(");
const to = html.indexOf("function upcomingSessions");
if (from < 0 || to < 0) { console.error("Không trích được code gốc"); process.exit(2); }
const origSrc = html.slice(from, to);

// Sandbox có sẵn CONFIG + localStorage giả (các hàm gốc chỉ tham chiếu, ta không gọi tới).
const sandbox = {
  CONFIG: cfg,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  JSON, Date, Array, Number, String, Math,
};
vm.runInNewContext(
  origSrc +
    "\nglobalThis.__orig = { isSchoolSession, sessionNumberOf, personForSession };",
  sandbox
);
const orig = sandbox.__orig || sandbox.globalThis?.__orig;

function dutyStr(fnSession, fnPerson, d) {
  const n = fnSession(cfg, d);
  if (n == null) return "—";
  const p = fnPerson(cfg, n);
  return `#${n} ${p.name} [${p.tag}]`;
}

// So sánh trên dải rộng: từ trước startDate 5 ngày tới +160 ngày.
const start = parseDate(cfg.startDate);
let mismatches = 0;
let sessions = 0;
const samples = [];
for (let k = -5; k <= 160; k++) {
  const d = addDays(start, k);
  const oSchool = orig.isSchoolSession(cfg, d);
  const pSchool = portIsSchool(cfg, d);
  const oStr = dutyStr(orig.sessionNumberOf, orig.personForSession, d);
  const pStr = dutyStr(portSessionNo, portPerson, d);
  if (oSchool !== pSchool || oStr !== pStr) {
    mismatches++;
    if (samples.length < 10) samples.push({ date: fmtISO(d), oStr, pStr, oSchool, pSchool });
  }
  if (oStr !== "—") sessions++;
}

console.log(`Đã đối chiếu ${166} ngày, bao gồm ${sessions} buổi học.`);
if (mismatches === 0) {
  console.log(`✅ KHỚP 100% — 0 lệch giữa bản port và code gốc.`);
  process.exit(0);
} else {
  console.error(`❌ Có ${mismatches} lệch:`);
  for (const s of samples) console.error("  ", s);
  process.exit(1);
}
