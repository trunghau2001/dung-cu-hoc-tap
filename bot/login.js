// ============================================================
// login.js — đăng nhập Zalo lần đầu bằng QR, lưu cred.json,
// rồi in ra danh sách "Tên nhóm => id" để lấy GROUP_ID.
//
// Chạy: node login.js   (mở qr.png rồi quét bằng app Zalo trên điện thoại)
// LƯU Ý: zca-js KHÔNG chính thức -> nên dùng TÀI KHOẢN ZALO PHỤ.
//
// Ghi chú API zca-js 2.1.2 (đã verify trong node_modules):
//  - Khi có callback, QR KHÔNG tự lưu -> phải bắt QRCodeGenerated rồi gọi
//    event.actions.saveToFile(qrPath).
//  - Sau khi đăng nhập xong, loginQR TỰ trả về `api`, và phát GotLoginInfo
//    với event.data = { cookie, imei, userAgent } để lưu làm credential.
// ============================================================
import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { Zalo, LoginQRCallbackEventType } from "zca-js";
import CONFIG from "./config.js";

const QR_PATH = "./qr.png";

async function main() {
  const zalo = new Zalo();
  let cred = null;

  console.log("Đang tạo mã QR đăng nhập...");
  const api = await zalo.loginQR({ qrPath: QR_PATH }, (event) => {
    switch (event.type) {
      case LoginQRCallbackEventType.QRCodeGenerated:
        // BẮT BUỘC tự lưu file khi dùng callback.
        event.actions.saveToFile(QR_PATH);
        console.log(`\n✅ Đã tạo mã QR: ${QR_PATH}`);
        console.log("👉 Mở file này và quét bằng app Zalo trên điện thoại (tài khoản PHỤ).");
        // Tự mở ảnh QR trên macOS cho tiện.
        exec(`open "${QR_PATH}"`, () => {});
        break;
      case LoginQRCallbackEventType.QRCodeScanned:
        console.log("📲 Đã quét QR:", event.data?.display_name || "");
        console.log("   Xác nhận đăng nhập trên điện thoại nhé...");
        break;
      case LoginQRCallbackEventType.QRCodeExpired:
        console.warn("⏰ Mã QR hết hạn. Chạy lại: node login.js");
        break;
      case LoginQRCallbackEventType.QRCodeDeclined:
        console.warn("❌ Đăng nhập bị từ chối trên điện thoại.");
        break;
      case LoginQRCallbackEventType.GotLoginInfo:
        // event.data = { cookie, imei, userAgent }
        cred = event.data;
        break;
    }
  });

  if (cred) {
    await writeFile(CONFIG.CRED_FILE, JSON.stringify(cred, null, 2), "utf8");
    console.log("\n✅ Đã lưu credential vào", CONFIG.CRED_FILE, "(đã gitignore — KHÔNG commit).");
  } else {
    console.warn("⚠️  Không nhận được thông tin đăng nhập. Có thể QR hết hạn/bị từ chối.");
  }

  // Liệt kê nhóm để lấy GROUP_ID.
  console.log("\nĐang lấy danh sách nhóm...");
  const all = await api.getAllGroups(); // { gridVerMap: { [groupId]: version } }
  const ids = Object.keys(all.gridVerMap || {});
  if (ids.length === 0) {
    console.log("(Tài khoản chưa ở trong nhóm nào — hãy thêm tài khoản này vào nhóm lớp trước.)");
  } else {
    const info = await api.getGroupInfo(ids); // { gridInfoMap: { [id]: { name, ... } } }
    const map = info.gridInfoMap || {};
    console.log("\n===== Danh sách nhóm (Tên => id) =====");
    for (const id of ids) {
      const name = map[id]?.name || "(không tên)";
      console.log(`  ${name}  =>  ${id}`);
    }
    console.log("\n👉 Copy id nhóm lớp rồi điền vào bot/config.js (GROUP_ID) hoặc đặt biến ZALO_GROUP_ID.");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error("Lỗi đăng nhập:", e?.message || e);
  console.error("Nếu lỗi liên quan API, đối chiếu README zca-js: https://github.com/RFS-ADRENO/zca-js");
  process.exit(1);
});
