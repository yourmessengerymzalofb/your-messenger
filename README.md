# Your Messenger – Giao diện cổ điển cho Zalo Web & Facebook (0.3.0 beta 1)

Chrome extension (MV3) hiển thị **Zalo Web** và **Facebook Messages** trong giao diện phong cách **YM v2**, gom chung một danh sách bạn. Dự án hoài niệm phi thương mại, không liên kết với Yahoo, Zalo hay Meta. Tên, logo, âm thanh và emoticon Y! thuộc về chủ sở hữu (xem [NOTICE.md](NOTICE.md)).

- Người dùng beta: [docs/CAI-DAT.md](docs/CAI-DAT.md) (cài đặt), [extension/safety.html](extension/safety.html) (an toàn & bản quyền, cũng mở được từ popup).
- Nghiệm thu trước mỗi bản phát hành: [qa/ACCEPTANCE-0.3.md](qa/ACCEPTANCE-0.3.md).
- Mã nguồn công khai: https://github.com/yourmessengerymzalofb/your-messenger (không kèm client YM v2). Giấy phép **PolyForm Noncommercial 1.0.0** ([LICENSE.md](LICENSE.md)), chỉ dùng phi thương mại; tài nguyên Yahoo không thuộc giấy phép này (xem [NOTICE.md](NOTICE.md)).

## Cách hoạt động

```
chat.zalo.me (tab chính)
  desktop YM v2 (#ym-root, phủ lên Zalo)  ←  src/yahoo/* (bundle: extension/yahoo/app/)
    cửa sổ YM!: tab Tất cả / Y! / Zalo / Facebook (hoặc 3 cửa sổ riêng)
    danh sách Zalo  ←  adapters/zalo (skin, host mode: đọc danh sách gốc, mở cửa sổ gốc bọc YM!)
    danh sách Facebook  ←  router  ←  tab facebook.com/messages (adapters/facebook + shared/bridge)
background/sw.js
  router.js        chuyển bản chụp Facebook sang desktop, chỉ trong RAM
  yahoo-proxy.js   cổng mạng duy nhất: chỉ tới máy chủ YM v2 (/api/…, /game-modules.json)
```

- **Chưa đăng nhập Y!:** vẫn có cửa sổ YM! với Zalo và Facebook. Tab Y! mời đăng ký (Tạo Y! ID 1 bấm, [src/yahoo/quick-id.mjs](src/yahoo/quick-id.mjs)) hoặc đăng nhập.
- **Đăng nhập Y! xong:** các tab chuyển vào buddy list Y! thật.
- **Tab Tất cả:** mục **Chưa đọc** gom tin chưa đọc của cả 3 app. Tiêu đề từng app bấm để thu gọn.
- **Popup:** gom chung hoặc 3 cửa sổ, ẩn Zalo/Facebook khỏi danh sách, xem mật khẩu Y! ID do plugin tạo.

## Quy tắc an toàn

- **Mạng:**
  - Chỉ tới máy chủ YM v2, qua service worker, với danh sách đường dẫn cho phép.
  - Realtime (tin đến tức thì) chưa bật: bản này không xin quyền tới máy chủ realtime; tin mới đến qua polling.
  - Luật DNR đặt Origin cho request do extension gửi. Luật thứ hai gắn cookie phiên Y! (quyền `cookies`, chỉ đọc được cookie của máy chủ YM v2) cho khung Y! 360° trong tab Zalo, chỉ khi khung do `yahoo/y360.html` hoặc trang Y! khởi tạo.
  - Không chạy trên trang đăng nhập Zalo (`id.zalo.me`).
- **Dữ liệu Zalo/Facebook không rời trình duyệt:** không gọi API của Zalo hay Facebook. Bản chụp Facebook qua router chỉ nằm trong RAM.
- **Thao tác trên Zalo/Facebook chỉ khi người dùng bấm thật** (`isTrusted`). Không tự gửi, không đoán hội thoại, không ghi đè bản nháp.
- **Không đọc mật khẩu Zalo/Facebook.** Mật khẩu Y! ID do plugin tạo chỉ nằm trong `chrome.storage.local`.
- **Test chỉ dùng dữ liệu giả.**

## Giới hạn đã biết

- Chỉ đọc được tin đang hiện trên trang gốc. Zalo dùng danh sách ảo: plugin cuộn để đọc thêm khi bấm "Tải thêm".
- Facebook cần một tab `facebook.com/messages` mở sẵn. Chrome có thể làm chậm tab nền.
- Bộ lọc của Zalo (vd. "Người lạ") làm danh sách gốc đổi theo. Danh sách Y! khi đó báo "Zalo đang lọc" và có nút về danh sách chính.
- Game và webcam trên trang Zalo chưa kiểm hết. Push notification tắt.
- Realtime chưa bật. Khi bật, thêm đúng một địa chỉ máy chủ realtime vào `host_permissions` (không dùng `*.workers.dev`).

## Phát triển

```powershell
npm install
node scripts/vendor-yahoo.mjs <đường dẫn tới mã YM v2>   # chỉ người có mã YM v2; repo công khai không kèm
npm test            # build bundle + toàn bộ test (node:test + jsdom)
npm run package     # bundle thu gọn + dist/Your-Messenger/ + Your-Messenger-<version>.zip + SHA256SUMS.txt
npm run publish     # cập nhật repo GitHub: một commit mới, không kèm YM v2 và dữ liệu riêng
node scripts/make-icons.mjs   # vẽ lại icon extension/icons/*
```

Nạp thử: `chrome://extensions` → Chế độ nhà phát triển → **Tải tiện ích đã giải nén** → chọn `extension/` (sau `npm run build`) hoặc thư mục trong `dist/`.

| Thư mục | Nội dung |
|---|---|
| `src/yahoo/` | Lớp port: boot, proxy fetch, env shim, cửa sổ kênh, tab gom chung, tạo ID |
| `vendor/yahoo-v2/` | Client YM v2 (giữ mọi quyền, **không có trong repo công khai**). Chép vào bằng `node scripts/vendor-yahoo.mjs <đường dẫn tới mã YM v2>`; build cần thư mục này. Patch có đếm trong `scripts/build-yahoo.mjs` |
| `extension/adapters/zalo`, `facebook` | Skin Zalo 0.2.7 và Facebook 0.6.0 (host mode) |
| `extension/background`, `shared` | Service worker (router, proxy) và hợp đồng message |
| `tests/` | `yahoo/`, `zalo/`, `facebook/`, `hub/` |
| `docs/` | Cài đặt, thêm app chat ([ADAPTER.md](docs/ADAPTER.md)), bài cộng đồng |
