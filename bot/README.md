# Bot nhắc trực dụng cụ qua Zalo

Tự động gửi tin vào nhóm Zalo lớp lúc **02:00 mỗi ngày** (nếu 2h máy tắt/ngủ thì gửi bù ngay
lần đầu mở máy): "hôm nay bạn nào phụ trách lấy dụng cụ".
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

## Tự động 2h sáng mỗi ngày bằng launchd (khuyến nghị cho Mac hay sleep)

Dùng `send-once.js` + launchd, **không** dùng `daemon.js`: launchd chạy **bù** job bị lỡ
khi Mac thức dậy (2h sáng máy thường tắt/ngủ → tin gửi ngay lần đầu mở máy, đúng dữ liệu
người trực của ngày đó); còn hẹn giờ trong `daemon.js` sẽ bỏ lỡ hẳn nếu máy ngủ qua 2h.

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

**Luật ngày (chống gửi sai/trùng):** tin của ngày nào chỉ gửi trong **đúng ngày đó**, mỗi
ngày **1 lần duy nhất**. `send-once.js` luôn tính người trực của hôm nay khi chạy nên không
bao giờ gửi tin ngày cũ; file mốc `bot/.last-sent-date` (không commit) chặn gửi trùng nếu job
chạy nhiều lần trong ngày. Nếu **cả ngày máy không bật** → launchd không chạy → **miss, không
gửi bù** sang ngày khác.

### (Tuỳ chọn) Để Mac tự thức lúc 2h sáng dù đang ngủ

Thường **không cần** — cứ để launchd gửi bù khi mở máy buổi sáng. Nếu muốn gửi đúng 2h,
cần **cắm sạc** và (với laptop) **không đậy nắp**:

```bash
sudo pmset repeat wake MTWRF 01:58:00   # thức lúc 01:58 các ngày T2–T6
pmset -g sched                          # xem lịch đã đặt
```

> Lưu ý: máy **tắt hẳn** (shutdown) thì pmset wake không bật máy được — lúc đó vẫn dựa vào
> cơ chế gửi bù khi mở máy lần đầu.

## Thông báo tự động (mục Quản lý trên web)

Ngoài tin nhắc trực 16h, có thể tạo **thông báo tuỳ ý** ngay trên web
(tab **Quản lý** → card **Thông báo tự động**): chọn **nhóm**, gõ **nội dung**,
đặt **giờ tròn** (0–23h giờ VN) và **lịch** (hàng ngày, hoặc theo một/nhiều ngày cụ thể).
Bấm «🚀 Lưu & đẩy» để lưu vào trang — bot đọc động, không cần sửa code.

- Lấy **ID nhóm** cho card «Nhóm Zalo» bằng `node login.js` (in ra "Tên nhóm => id").
- Chạy tự động: agent launchd `com.lopmuong.zaloannounce.plist` chạy **mỗi đầu giờ** trên Mac,
  gửi các thông báo trùng giờ VN hiện tại. Giờ nào không có thông báo thì không gửi gì.

```bash
node send-announcements.js --dry-run            # in các thông báo tới hạn giờ này
node send-announcements.js --dry-run --hour 20  # giả lập giờ 20h để thử
node send-announcements.js                       # gửi thật
```

## File trong dự án

| File | Vai trò |
|------|---------|
| `config.js` | GROUP_ID, mẫu tin, nguồn đọc trang, múi giờ, CRED_FILE |
| `roster.js` | Đọc CONFIG (gồm groups/announcements) + tính người trực + lọc thông báo tới hạn |
| `roster.test.js` | Đối chiếu port ⇄ code gốc trong index.html |
| `login.js` | Quét QR, lưu `cred.json`, in "Tên nhóm => id" |
| `send-once.js` | Gửi 1 tin nhắc trực rồi thoát (macOS/launchd). Hỗ trợ `--dry-run` |
| `send-announcements.js` | Gửi các thông báo tới hạn ở giờ hiện tại. `--dry-run`, `--hour N` |
| `daemon.js` | Login + giữ session + cron nội bộ (cho máy luôn bật, KHÔNG hợp macOS) |
| `com.lopmuong.zalobot.plist` | launchd agent nhắc trực chạy 2h sáng mỗi ngày (gửi bù khi mở máy) |
| `com.lopmuong.zaloannounce.plist` | launchd agent gửi Thông báo tự động, chạy mỗi đầu giờ |

> **Đã gỡ khỏi GitHub Actions** (lịch cron GitHub hay bị bỏ nhịp, ~90% lần chạy bị rớt).
> Toàn bộ gửi tin chạy **local qua launchd** trên Mac. Nạp/gỡ agent:
>
> ```bash
> cp com.lopmuong.zalobot.plist com.lopmuong.zaloannounce.plist ~/Library/LaunchAgents/
> launchctl load -w ~/Library/LaunchAgents/com.lopmuong.zalobot.plist
> launchctl load -w ~/Library/LaunchAgents/com.lopmuong.zaloannounce.plist
> launchctl list | grep zalo                 # kiểm tra đã nạp
> launchctl unload ~/Library/LaunchAgents/com.lopmuong.zalobot.plist   # gỡ khi cần
> ```

> **Chạy thông báo bằng launchd (local):** thêm một agent nữa giống plist trên nhưng gọi
> `send-announcements.js` với `StartCalendarInterval` là `Minute 0` (mỗi đầu giờ).
