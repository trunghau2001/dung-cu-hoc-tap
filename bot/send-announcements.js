// ============================================================
// send-announcements.js — gửi các THÔNG BÁO tự động tới hạn ở giờ hiện tại.
//
// Chạy mỗi đầu giờ (cron hàng giờ). Đọc danh sách `announcements` ĐỘNG trong CONFIG
// trên trang, lọc những thông báo có hour == giờ VN hiện tại và (mode "daily" hoặc
// mode "dates" chứa ngày hôm nay), rồi gửi vào đúng nhóm của từng thông báo.
//
// Chạy thử:  node send-announcements.js --dry-run          (in ra, không gửi)
//            node send-announcements.js --hour 8 --dry-run (giả lập giờ 8h)
// Gửi thật:  node send-announcements.js
//
// Credential: đọc từ ZALO_CRED (JSON) nếu có, ngược lại từ cred.json.
// ============================================================
import { readFile } from "node:fs/promises";
import { Zalo, ThreadType } from "zca-js";
import CONFIG from "./config.js";
import { parseConfig, fetchHtml, nowVN, announcementsDue } from "./roster.js";

const DRY_RUN = process.argv.includes("--dry-run");
const hourArgIdx = process.argv.indexOf("--hour");
const HOUR_OVERRIDE = hourArgIdx >= 0 ? parseInt(process.argv[hourArgIdx + 1], 10) : null;

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
  const now = nowVN();
  const hour = HOUR_OVERRIDE != null && !Number.isNaN(HOUR_OVERRIDE) ? HOUR_OVERRIDE : now.hour;

  const cfg = parseConfig(await fetchHtml());
  const due = announcementsDue(cfg, now.iso, hour);

  console.log(`[${now.iso} ${hour}h VN] Có ${due.length} thông báo tới hạn.`);
  if (due.length === 0) process.exit(0);

  const nameOf = (id) => {
    const g = (cfg.groups || []).find((x) => x.id === id);
    return g && g.name ? g.name : id;
  };

  for (const a of due) {
    console.log(`- Nhóm «${nameOf(a.groupId)}» (${a.groupId})\n  ${a.content.replace(/\n/g, "\n  ")}`);
  }

  if (DRY_RUN) {
    console.log("(--dry-run: KHÔNG gửi.)");
    process.exit(0);
  }

  const cred = await loadCred();
  const zalo = new Zalo();
  const api = await zalo.login({ imei: cred.imei, cookie: cred.cookie, userAgent: cred.userAgent });

  let ok = 0, fail = 0;
  for (const a of due) {
    try {
      await api.sendMessage(a.content, a.groupId, ThreadType.Group);
      console.log(`✅ Đã gửi tới «${nameOf(a.groupId)}» (${a.groupId})`);
      ok++;
    } catch (e) {
      console.error(`❌ Lỗi gửi tới ${a.groupId}:`, e?.message || e);
      fail++;
    }
  }
  console.log(`Xong: ${ok} gửi được, ${fail} lỗi.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Lỗi gửi thông báo:", e?.message || e);
  process.exit(1);
});
