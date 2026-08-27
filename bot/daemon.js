// ============================================================
// daemon.js — đăng nhập 1 lần, giữ session sống, tự gửi lúc 16h mỗi ngày.
//
// DÀNH CHO MÁY LUÔN BẬT (Raspberry Pi / VPS). KHÔNG hợp macOS hay sleep:
// nếu máy ngủ qua 16h thì cron nội bộ bỏ lỡ luôn. Trên macOS dùng send-once.js + launchd.
//
// Chạy: node daemon.js
// ============================================================
import { readFile } from "node:fs/promises";
import cron from "node-cron";
import { Zalo, ThreadType } from "zca-js";
import CONFIG from "./config.js";
import { parseConfig, fetchHtml, dutyForDate } from "./roster.js";

function fillTemplate(tpl, duty) {
  return tpl
    .replaceAll("{name}", duty.name)
    .replaceAll("{tag}", duty.tag)
    .replaceAll("{dateVN}", duty.dateVN)
    .replaceAll("{session}", String(duty.session));
}

async function loadCred() {
  const raw = await readFile(CONFIG.CRED_FILE, "utf8").catch(() => null);
  if (!raw) throw new Error("Chưa có credential. Chạy `node login.js` trước.");
  return JSON.parse(raw);
}

async function sendDuty(api) {
  const html = await fetchHtml();
  const cfg = parseConfig(html);
  const duty = dutyForDate(cfg);
  if (!duty.isSession) {
    console.log(`[${new Date().toISOString()}] Bỏ qua — ${duty.reason}`);
    return;
  }
  const text = fillTemplate(CONFIG.MESSAGE_TEMPLATE, duty);
  await api.sendMessage(text, CONFIG.GROUP_ID, ThreadType.Group);
  console.log(`[${new Date().toISOString()}] Đã gửi: ${duty.name} (${duty.tag})`);
}

async function main() {
  if (!CONFIG.GROUP_ID) throw new Error("Chưa có GROUP_ID.");
  const cred = await loadCred();
  const zalo = new Zalo();
  const api = await zalo.login({
    imei: cred.imei,
    cookie: cred.cookie,
    userAgent: cred.userAgent,
  });
  api.listener.start(); // giữ websocket sống
  console.log("Daemon đã đăng nhập. Chờ 16:00 mỗi ngày (giờ VN)...");

  // 16:00 hằng ngày theo giờ VN.
  cron.schedule("0 16 * * *", () => {
    sendDuty(api).catch((e) => console.error("Lỗi gửi:", e?.message || e));
  }, { timezone: CONFIG.TIMEZONE });
}

main().catch((e) => {
  console.error("Lỗi daemon:", e?.message || e);
  process.exit(1);
});
