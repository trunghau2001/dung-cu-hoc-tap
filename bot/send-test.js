// ============================================================
// send-test.js — GỬI THỬ có nhãn [TEST], BỎ QUA kiểm tra ngày học.
// Dùng để kiểm chứng đường gửi (đặc biệt trên GitHub Actions) mà không phải chờ 16h/ngày học.
//
// Chạy: node send-test.js <groupId>
//   hoặc đặt biến ZALO_TEST_GROUP_ID. Credential lấy từ ZALO_CRED (JSON) hoặc cred.json.
// ============================================================
import { readFile } from "node:fs/promises";
import { Zalo, ThreadType } from "zca-js";
import CONFIG from "./config.js";
import { parseConfig, fetchHtml, dutyForDate, todayVN, addDays } from "./roster.js";

const groupId = process.argv[2] || process.env.ZALO_TEST_GROUP_ID || "";

async function loadCred() {
  if (process.env.ZALO_CRED) {
    try { return JSON.parse(process.env.ZALO_CRED); }
    catch { throw new Error("ZALO_CRED không phải JSON hợp lệ."); }
  }
  const raw = await readFile(CONFIG.CRED_FILE, "utf8").catch(() => null);
  if (!raw) throw new Error("Chưa có credential. Chạy `node login.js` trước.");
  return JSON.parse(raw);
}

async function main() {
  if (!groupId) throw new Error("Thiếu groupId. Dùng: node send-test.js <groupId> hoặc đặt ZALO_TEST_GROUP_ID.");

  // Lấy nội dung thật của buổi học gần nhất để tin trông giống thật.
  const cfg = parseConfig(await fetchHtml());
  let d = todayVN(), duty = dutyForDate(cfg, d), guard = 0;
  while (!duty.isSession && guard++ < 21) { d = addDays(d, 1); duty = dutyForDate(cfg, d); }

  const body = CONFIG.MESSAGE_TEMPLATE
    .replaceAll("{name}", duty.name)
    .replaceAll("{tag}", duty.tag)
    .replaceAll("{dateVN}", duty.dateVN)
    .replaceAll("{session}", String(duty.session));
  const text = "[TEST] Bot nhắc trực — tin thử từ server, bỏ qua nhé 🙏\n\n" + body;

  console.log("Buổi mẫu:", duty.dateVN, "->", duty.name);
  const cred = await loadCred();
  const zalo = new Zalo();
  const api = await zalo.login({ imei: cred.imei, cookie: cred.cookie, userAgent: cred.userAgent });
  await api.sendMessage(text, groupId, ThreadType.Group);
  console.log("✅ Đã gửi [TEST] vào nhóm", groupId);
  process.exit(0);
}

main().catch((e) => {
  console.error("Lỗi gửi test:", e?.message || e);
  process.exit(1);
});
