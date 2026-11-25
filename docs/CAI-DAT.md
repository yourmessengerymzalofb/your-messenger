# Cài Your Messenger – Giao diện cổ điển cho Zalo Web, Facebook & Telegram (bản beta)

Your Messenger hiển thị Zalo Web, Facebook Messages và Telegram Web trong giao diện phong cách YM!, gom chung một danh sách bạn. Dự án hoài niệm phi thương mại, không liên kết với Yahoo, Zalo, Meta hay Telegram.

Dùng trên **máy tính**, trình duyệt **Chrome** (hoặc Edge, Cốc Cốc, Brave). Chưa có bản điện thoại.

## 1. Kiểm tra tệp tải về

Bạn nhận được `Your-Messenger-<phiên bản>.zip` và mã SHA-256 của nó từ kênh chính thức. So mã trước khi cài.

**Windows:** mở PowerShell trong thư mục chứa tệp zip rồi chạy:

```
Get-FileHash .\Your-Messenger-0.4.0.zip -Algorithm SHA256
```

**macOS:** mở Terminal trong thư mục chứa tệp zip rồi chạy:

```
shasum -a 256 Your-Messenger-0.4.0.zip
```

Mã hiện ra phải trùng với mã được công bố. Nếu khác thì đừng cài.

## 2. Đăng nhập Zalo Web, Facebook và Telegram trước

1. Mở `https://chat.zalo.me` và đăng nhập như bình thường (quét QR hoặc mật khẩu).
2. Mở `https://www.facebook.com/messages` và đăng nhập.
3. (Nếu dùng Telegram) mở `https://web.telegram.org/a/` và đăng nhập. Dùng bản **A**; bản K chưa hỗ trợ.

Plugin không hỏi và không thấy mật khẩu Zalo, Facebook hay Telegram. Đăng nhập trước khi cài là cách để bạn yên tâm điều đó.

## 3. Cài plugin

1. Giải nén tệp zip vào một chỗ cố định (ví dụ `Documents`). Bạn sẽ có thư mục `Your-Messenger`.
2. Mở `chrome://extensions`.
3. Bật **Chế độ dành cho nhà phát triển** (góc trên bên phải).
4. Bấm **Tải tiện ích đã giải nén**, rồi chọn thư mục `Your-Messenger`.
5. Ghim plugin lên thanh công cụ: bấm biểu tượng mảnh ghép → ghim **Your Messenger**.

Đừng xóa hay di chuyển thư mục sau khi cài: Chrome chạy plugin từ chính thư mục đó.

## 4. Dùng

1. Quay lại tab Zalo và bấm **F5**. Desktop Y! hiện ra với cửa sổ **YM!**.
2. Các tab **Tất cả / Y! / Zalo / Facebook / Telegram** nằm trong cửa sổ. Zalo, Facebook và Telegram dùng được ngay, chưa cần Y! ID.
3. Facebook cần một tab `facebook.com/messages` mở sẵn, Telegram cần một tab `web.telegram.org/a/` (nên ghim các tab đó).
4. Muốn BUZZ!!!, chơi game, chat với bạn Y!: vào tab **Y!**, bấm **Tạo Y! ID** (1 bấm), hoặc **Đã có Y! ID? Đăng nhập**.
   - Mật khẩu Y! ID do plugin tạo hiện một lần để bạn chép. Xem lại được trong popup của plugin.
5. Muốn về giao diện Zalo gốc: bấm nút **Zalo** ở góc phải thanh taskbar. Bấm nút tròn **Y!** ở mép phải màn hình để quay lại.

Các lựa chọn khác nằm trong popup (bấm biểu tượng plugin), chọn xong bấm **Lưu**: plugin lưu và tự tải lại tab Zalo.
- tắt hoặc bật YM! trên Zalo Web;
- một cửa sổ YM! cho mọi app, hoặc mỗi app một cửa sổ riêng.

App nào hiện trong **Tất cả** thì bấm nút **Tất cả ▾** trong cửa sổ YM! để chọn.

## 5. Khi Zalo, Facebook hoặc Telegram đòi đăng nhập lại

1. Tắt Your Messenger ở `chrome://extensions`.
2. Đăng nhập lại app đó.
3. Bật plugin, rồi F5 tab Zalo.

## 6. Cập nhật lên bản mới

Bản cài thủ công không tự cập nhật.

1. Tải bản mới và so mã SHA-256 như bước 1.
2. Giải nén **đè lên đúng thư mục `Your-Messenger` cũ**. Đừng nạp thư mục ở chỗ khác: Chrome sẽ coi là plugin mới, mất Y! ID đã lưu và các lựa chọn.
3. Ở `chrome://extensions`, bấm nút **tải lại** (mũi tên vòng) của Your Messenger, rồi F5 tab Zalo.

## 7. Gỡ

Ở `chrome://extensions`, bấm **Xóa** ở Your Messenger, rồi xóa thư mục. Zalo, Facebook và Telegram trở về như cũ.

## Báo lỗi

Gửi vào kênh beta. Ghi rõ những điều sau, kèm ảnh chụp nếu được (che tên và tin nhắn riêng tư):
- phiên bản: hiện trong popup;
- trình duyệt;
- đang làm gì thì gặp lỗi;
- thấy gì.

Chi tiết về quyền và dữ liệu: bấm **An toàn & bản quyền** trong popup của plugin.
