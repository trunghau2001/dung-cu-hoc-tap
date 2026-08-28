// ============================================================
// send-once.js — gửi 1 tin nhắc trực rồi thoát. DÙNG BẢN NÀY trên macOS (qua launchd).
//
// Chạy thử:   node send-once.js --dry-run     (chỉ in tin, không gửi)
// Gửi thật:   node send-once.js
//
// Credential: đọc từ biến môi trường ZALO_CRED (chuỗi JSON) nếu có, ngược lại từ cred.json.
// ============================================================
import { readFile } from "node:fs/promises";
import { Zalo, ThreadType } from "zca-js";
import CONFIG from "./config.js";
import { parseConfig, fetchHtml, dutyForDate, nowVN } from "./roster.js";

const DRY_RUN = process.argv.includes("--dry-run");

function fillTemplate(tpl, duty) {
  return tpl
    .replaceAll("{name}", duty.name)
    .replaceAll("{tag}", duty.tag)
    .replaceAll("{dateVN}", duty.dateVN)
    .replaceAll("{session}", String(duty.session));
}

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
  // 1) Tính người trực hôm nay từ dữ liệu ĐỘNG trên trang.
  const html = await fetchHtml();
  const cfg = parseConfig(html);
  const duty = dutyForDate(cfg); // hôm nay theo giờ VN

  if (!duty.isSession) {
    console.log(`[${duty.dateVN}] Bỏ qua — ${duty.reason}`);
    process.exit(0);
  }
  // Chặn an toàn: không gửi nếu không xác định được người trực (vd danh sách trống).
  if (!duty.name || duty.name === "—") {
    console.log(`[${duty.dateVN}] Bỏ qua — không xác định được người trực.`);
    process.exit(0);
  }

  const text = fillTemplate(CONFIG.MESSAGE_TEMPLATE, duty);
  console.log(`[${duty.dateVN}] Buổi ${duty.session} — trực: ${duty.name} (${duty.tag})`);
  console.log("----- Nội dung tin -----\n" + text + "\n------------------------");

  if (DRY_RUN) {
    console.log("(--dry-run: KHÔNG gửi.)");
    process.exit(0);
  }

  // Chốt giờ: GitHub có thể chạy lịch trễ nhiều giờ. Nếu EXPECT_HOUR được đặt (từ workflow
  // theo lịch) mà giờ VN hiện tại KHÔNG khớp thì bỏ qua, tránh gửi sai giờ (vd 2h sáng).
  // Chạy tay (không đặt EXPECT_HOUR) thì gửi ngay, tiện test.
  if (process.env.EXPECT_HOUR !== undefined && process.env.EXPECT_HOUR !== "") {
    const { hour } = nowVN();
    const want = parseInt(process.env.EXPECT_HOUR, 10);
    if (hour !== want) {
      console.log(`[${duty.dateVN}] Bỏ qua — giờ VN hiện tại ${hour}h, chỉ gửi lúc ${want}h (GitHub chạy trễ).`);
      process.exit(0);
    }
  }

  if (!CONFIG.GROUP_ID) {
    throw new Error("Chưa có GROUP_ID. Điền vào bot/config.js hoặc đặt biến ZALO_GROUP_ID.");
  }

  // 2) Đăng nhập lại bằng credential đã lưu và gửi.
  const cred = await loadCred();
  const zalo = new Zalo();
  const api = await zalo.login({
    imei: cred.imei,
    cookie: cred.cookie,
    userAgent: cred.userAgent,
  });

  await api.sendMessage(text, CONFIG.GROUP_ID, ThreadType.Group);
  console.log("✅ Đã gửi vào nhóm", CONFIG.GROUP_ID);
  process.exit(0);
}

main().catch((e) => {
  console.error("Lỗi gửi tin:", e?.message || e);
  process.exit(1);
});
