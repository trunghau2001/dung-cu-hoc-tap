# Bot nhắc trực dụng cụ qua Zalo

Tự động gửi tin vào nhóm Zalo lớp lúc **16:00 mỗi ngày**: "hôm nay bạn nào phụ trách lấy dụng cụ".
Tự bỏ qua ngày không phải buổi học. Dữ liệu đọc **động** từ trang
<https://trunghau2001.github.io/dung-cu-hoc-tap/> (không hardcode).

> ⚠️ `zca-js` là thư viện **không chính thức** → nên đăng nhập bằng **tài khoản Zalo phụ**.
> `cred.json` chứa cookie đăng nhập — đã được `.gitignore`, **không commit**.

## Các bước cài & chạy (macOS)

```bash
cd bot
npm install                 # cài zca-js + node-cron
node roster.test.js         # phải in "KHỚP 100% — 0 lệch"

node login.js               # mở qr.png, quét bằng app Zalo -> lưu cred.json + in "Tên nhóm => id"
# -> copy id nhóm lớp, dán vào GROUP_ID trong config.js (hoặc đặt biến ZALO_GROUP_ID)

node send-once.js --dry-run # xem thử nội dung tin (không gửi)
node send-once.js           # gửi thật 1 lần
```

## Tự động 16h mỗi ngày bằng launchd (khuyến nghị cho Mac hay sleep)

Dùng `send-once.js` + launchd, **không** dùng `daemon.js`: launchd chạy **bù** job bị lỡ
khi Mac thức dậy; còn hẹn giờ trong `daemon.js` sẽ bỏ lỡ nếu máy ngủ qua 16h.

```bash
# 1) Sửa __NODE_BIN__ trong com.lopmuong.zalobot.plist bằng đường dẫn thật:
which node                  # ví dụ /opt/homebrew/bin/node

# 2) Copy plist vào LaunchAgents rồi nạp:
cp com.lopmuong.zalobot.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.lopmuong.zalobot.plist

# Kiểm tra / gỡ:
launchctl list | grep zalobot
launchctl unload ~/Library/LaunchAgents/com.lopmuong.zalobot.plist   # gỡ khi cần
```

Log ghi ở `bot/zalobot.log` và `bot/zalobot.err.log`.

### (Tuỳ chọn) Để Mac tự thức trước 16h dù đang ngủ

Cần **cắm sạc** và (với laptop) **không đậy nắp**:

```bash
sudo pmset repeat wake MTWRF 15:58:00   # thức lúc 15:58 các ngày T2–T6
pmset -g sched                          # xem lịch đã đặt
```

## File trong dự án

| File | Vai trò |
|------|---------|
| `config.js` | GROUP_ID, mẫu tin, nguồn đọc trang, múi giờ, CRED_FILE |
| `roster.js` | Đọc CONFIG từ index.html + tính người trực (port khớp code gốc) |
| `roster.test.js` | Đối chiếu port ⇄ code gốc trong index.html |
| `login.js` | Quét QR, lưu `cred.json`, in "Tên nhóm => id" |
| `send-once.js` | Gửi 1 lần rồi thoát (dùng cho macOS/launchd). Hỗ trợ `--dry-run` |
| `daemon.js` | Login + giữ session + cron nội bộ (cho máy luôn bật, KHÔNG hợp macOS) |
| `com.lopmuong.zalobot.plist` | launchd agent chạy 16h mỗi ngày |
