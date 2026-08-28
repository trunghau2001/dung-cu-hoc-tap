// ============================================================
// Cấu hình bot nhắc trực dụng cụ qua Zalo
// ============================================================
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CONFIG = {
  // Nguồn dữ liệu: trang GitHub Pages đã deploy. Bot đọc ĐỘNG khối CONFIG trong đây,
  // KHÔNG hardcode ngày nghỉ / danh sách học sinh.
  SOURCE_URL: "https://trunghau2001.github.io/dung-cu-hoc-tap/",

  // Dự phòng đọc file local (dùng cho test / khi không có mạng). Trỏ tới index.html của repo.
  LOCAL_HTML: join(__dirname, "..", "index.html"),

  // ID nhóm Zalo cần gửi. Lấy được sau khi chạy `node login.js` (in ra "Tên nhóm => id").
  // Ưu tiên biến môi trường ZALO_GROUP_ID; nếu trống thì điền trực tiếp vào chuỗi dưới.
  // ⚠️ ĐANG TEST: gửi vào nhóm "Tây Du Kí" cho an toàn.
  //    Khi chạy THẬT: đổi lại thành "8512857535213641841" (nhóm "Xóm 8").
  GROUP_ID: process.env.ZALO_GROUP_ID || "3191333390522945563", // TEST: "Tây Du Kí" | THẬT: "8512857535213641841" (Xóm 8)

  // Mẫu tin nhắn. Placeholder dùng được: {name} {dateVN} (còn {tag} {session} vẫn hỗ trợ nếu cần).
  MESSAGE_TEMPLATE:
    "📢 Nhắc trực dụng cụ hôm nay ({dateVN})\n" +
    "👉 Bạn phụ trách lấy dụng cụ: {name}\n" +
    "Nhờ bạn chuẩn bị giúp lớp nhé! 🙏",

  // Múi giờ dùng để xác định "hôm nay" và lịch cron.
  TIMEZONE: "Asia/Ho_Chi_Minh",

  // Nơi lưu credential đăng nhập Zalo (cookie/imei/userAgent). KHÔNG commit file này.
  CRED_FILE: join(__dirname, "cred.json"),

  // File mốc ngày đã gửi (DD/MM/YYYY của lần gửi gần nhất). Dùng để chốt luật:
  // mỗi ngày chỉ gửi 1 lần, và chỉ gửi cho ĐÚNG ngày hôm đó. KHÔNG commit.
  SENT_MARKER: join(__dirname, ".last-sent-date"),
};

export default CONFIG;
