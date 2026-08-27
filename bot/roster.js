// ============================================================
// roster.js — đọc CONFIG từ index.html + tính người trực
//
// Thuật toán được PORT NGUYÊN VĂN từ index.html (parseDate, fmtISO, addDays,
// isSchoolSession, buildAssignments, personForSession, sessionNumberOf).
// Đừng sửa logic trừ khi roster.test.js vẫn xanh.
// ============================================================
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import CONFIG from "./config.js";

// ---------- Tiện ích ngày (port từ index.html) ----------
export function parseDate(s) { // "YYYY-MM-DD" -> Date (local midnight)
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function fmtISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}
export function fmtVN(d) { // 25/08/2026
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
}
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

// ---------- Logic phân công (port từ index.html) ----------
export function isSchoolSession(cfg, d) {
  const iso = fmtISO(d);
  if (cfg.disabledDates.includes(iso)) return false;
  return cfg.schoolDays.includes(d.getDay())
      || (cfg.extraDates || []).includes(iso);
}
export function buildAssignments(cfg, upto) {
  const n = cfg.students.length;
  const out = [];
  if (n === 0) return out;
  const counts = cfg.students.map((s) => Math.max(0, s.count | 0));
  for (let k = 0; k < upto; k++) {
    let mi = 0;
    for (let i = 1; i < n; i++) if (counts[i] < counts[mi]) mi = i;
    counts[mi]++;
    out.push({ idx: mi, level: counts[mi] });
  }
  return out;
}
export function personForSession(cfg, n) {
  if (cfg.students.length === 0 || n < 1) return { name: "—", tag: "", cls: "round-n" };
  const a = buildAssignments(cfg, n);
  const { idx, level } = a[n - 1];
  const s = cfg.students[idx];
  if (level === 1) return { name: s.name, tag: "Đợt 1", cls: "round-1" };
  return { name: s.name, tag: "Vòng " + level, cls: "round-n" };
}
export function sessionNumberOf(cfg, d) {
  const start = parseDate(cfg.startDate);
  if (d < start) return null;
  if (!isSchoolSession(cfg, d)) return null;
  let n = 0;
  for (let cur = new Date(start); cur <= d; cur = addDays(cur, 1)) {
    if (isSchoolSession(cfg, cur)) n++;
  }
  return n;
}

// ---------- Đọc CONFIG từ HTML ----------
const START_MARK = "// ===== CONFIG START =====";
const END_MARK = "// ===== CONFIG END =====";

// Trích khối "const CONFIG = {...}" giữa 2 marker rồi chạy trong sandbox an toàn.
export function parseConfig(html) {
  const i = html.indexOf(START_MARK);
  const j = html.indexOf(END_MARK, i);
  if (i < 0 || j < 0) throw new Error("Không tìm thấy khối CONFIG trong HTML");
  const block = html.slice(i, j); // gồm cả "const CONFIG = {...};"
  // Chạy trong context rỗng (không require/process/fs) -> chỉ lấy ra object dữ liệu.
  const cfg = vm.runInNewContext(block + "\nCONFIG", Object.create(null), {
    timeout: 1000,
  });
  // Chuẩn hóa tối thiểu để khớp normalizeCfg của trang.
  return {
    startDate: cfg.startDate,
    schoolDays: Array.isArray(cfg.schoolDays) ? cfg.schoolDays : [],
    disabledDates: Array.isArray(cfg.disabledDates) ? cfg.disabledDates : [],
    extraDates: Array.isArray(cfg.extraDates) ? cfg.extraDates : [],
    students: (cfg.students || []).map((s) => ({
      name: s.name,
      count: typeof s.count === "number" ? Math.max(0, s.count | 0) : (s.done ? 1 : 0),
    })),
    groups: (Array.isArray(cfg.groups) ? cfg.groups : []).map((g) => ({
      name: String(g.name || "").trim(),
      id: String(g.id || "").trim(),
    })),
    announcements: (Array.isArray(cfg.announcements) ? cfg.announcements : []).map((a) => ({
      id: a.id,
      groupId: String(a.groupId || "").trim(),
      hour: Math.min(23, Math.max(0, a.hour | 0)),
      mode: a.mode === "dates" ? "dates" : "daily",
      dates: Array.isArray(a.dates) ? a.dates.slice() : [],
      enabled: a.enabled !== false,
      content: String(a.content || ""),
    })),
  };
}

// Múi giờ VN, trả về giờ hiện tại (0-23) và ngày ISO "YYYY-MM-DD".
export function nowVN() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0; // một số môi trường trả "24" cho nửa đêm
  return { iso, hour };
}

// Lọc các thông báo phải gửi tại (isoDate, hour) — giờ tròn theo giờ VN.
export function announcementsDue(cfg, iso, hour) {
  return (cfg.announcements || []).filter((a) => {
    if (!a.enabled) return false;
    if (!a.groupId || !a.content.trim()) return false;
    if (a.hour !== hour) return false;
    if (a.mode === "daily") return true;
    return a.dates.includes(iso);
  });
}

// Lấy HTML: ưu tiên trang đã deploy; nếu lỗi mạng thì fallback file local.
export async function fetchHtml() {
  try {
    const res = await fetch(CONFIG.SOURCE_URL, {
      headers: { "cache-control": "no-cache" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } catch (e) {
    // Fallback: đọc index.html trong repo.
    return await readFile(CONFIG.LOCAL_HTML, "utf8");
  }
}

// "Hôm nay" theo múi giờ VN, trả về Date ở local-midnight của ngày VN đó.
export function todayVN() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG.TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // "YYYY-MM-DD"
  return parseDate(parts);
}

// Kết quả trực của một ngày (mặc định hôm nay theo giờ VN).
export function dutyForDate(cfg, date) {
  const d = date || todayVN();
  const n = sessionNumberOf(cfg, d);
  if (n == null) {
    let reason = "Hôm nay không phải buổi học.";
    if (d < parseDate(cfg.startDate)) reason = "Lịch bắt đầu từ " + fmtVN(parseDate(cfg.startDate)) + ".";
    return { isSession: false, date: d, dateVN: fmtVN(d), reason };
  }
  const p = personForSession(cfg, n);
  return {
    isSession: true,
    date: d,
    dateVN: fmtVN(d),
    session: n,
    name: p.name,
    tag: p.tag,
  };
}

export default { parseConfig, fetchHtml, dutyForDate, todayVN, nowVN, announcementsDue };
