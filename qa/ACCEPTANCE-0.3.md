# Nghiệm thu Your Messenger 0.3.x

Chạy trước mỗi bản phát hành beta. Đánh `[x]` khi đạt, ghi ngày và người kiểm. Kiểm trên Chrome thật với tài khoản thật của người kiểm. Không chụp màn hình có tin nhắn riêng tư vào repo.

Bản: `____`  Ngày: `____`  Người kiểm: `____`

## A. Tự động

- [ ] `npm test` xanh toàn bộ.
- [ ] `npm run package` tạo `dist/Your-Messenger-<version>.zip` và `SHA256SUMS.txt`. Mã SHA-256 trong file khớp với `Get-FileHash`.
- [ ] Popup hiện đúng phiên bản (`version_name`).

## B. Cài mới (hồ sơ Chrome chưa từng dùng plugin)

- [ ] Đăng nhập Zalo Web và Facebook trước, sau đó cài từ zip theo [docs/CAI-DAT.md](../docs/CAI-DAT.md).
- [ ] `chrome://extensions` → Chi tiết: quyền đúng như trang An toàn & bản quyền.
- [ ] F5 Zalo: desktop Y! hiện ra, cửa sổ YM! ghi "Chưa đăng nhập Y!", cửa sổ đăng nhập Y! ẩn.
- [ ] Tab Zalo có nhóm và bạn thật; tab Facebook có hội thoại (khi tab Messages mở).
- [ ] Tab Y!: khung mời đăng ký, có dòng "không liên kết".
- [ ] **Tạo Y! ID:** nick gợi ý → Tạo → desktop đăng nhập, hộp mật khẩu hiện, "Chép mật khẩu" chép được.
- [ ] Popup → mục Y! ID: Hiện/Ẩn mật khẩu, Chép.
- [ ] Nick đã có người dùng: báo lỗi, gợi ý nick khác, không lưu mật khẩu.

## C. Danh sách bạn

- [ ] Gom chung: 4 tab có số chưa đọc. Tab đang chọn được nhớ sau F5.
- [ ] Tất cả → **Chưa đọc**: có dòng chưa đọc của Zalo/Facebook kèm huy hiệu Z/f; bấm vào mở đúng hội thoại.
- [ ] Bấm tiêu đề Zalo trong Tất cả: thu gọn/mở; nhớ sau F5.
- [ ] Ô tìm kiếm lọc cả Zalo và Facebook.
- [ ] Popup → bỏ tick Facebook → F5: không còn tab/cửa sổ Facebook. Tick lại → có lại.
- [ ] Popup → 3 cửa sổ riêng → F5: Zalo, Facebook, Y! mỗi app một cửa sổ, kéo/thu nhỏ được.
- [ ] Bấm "Tin nhắn từ người lạ": danh sách báo "Zalo đang lọc: Người lạ"; **← Về danh sách chính** trả lại đủ nhóm và bạn.
- [ ] "Tải thêm nhóm" và "Tải thêm" của Zalo chạy trong cửa sổ Y!.

## D. Chat

- [ ] Mở hội thoại Zalo: cửa sổ chat kiểu Y!, gửi một tin vào **My Documents** (Cloud của tôi). Tin hiện trên Zalo gốc.
- [ ] Mở hội thoại Facebook: tin đang hiện được vẽ lại; nút "Xem trên Facebook" chạy.
- [ ] Y!: chat với một bạn ảo, BUZZ!!!, emoticon.

## E. Đăng xuất, đăng nhập lại

- [ ] Đăng xuất Y!: quay về cửa sổ khách, Zalo/Facebook còn nguyên; nút "Đăng nhập nhanh: <nick>" chạy.
- [ ] F5 khi phiên Y! hết hạn (ID do plugin tạo): tự đăng nhập lại.
- [ ] Zalo hết phiên khi plugin bật: không bị kẹt; nút Zalo ở khay về giao diện gốc.

## F. Desktop Y!

- [ ] Nút Zalo ở khay ↔ nút Y!: chuyển qua lại, không mất trạng thái.
- [ ] Winamp phát nhạc (YouTube nhúng).
- [ ] Game: mở một ván với máy. Webcam: mở cửa sổ, báo đúng nếu trang chặn.
- [ ] Popup → tắt desktop → F5: Zalo gốc nguyên vẹn.

## G. An toàn

- [ ] F12 → Network trên tab Zalo: request của plugin chỉ tới máy chủ YM v2.
- [ ] Không có thao tác Zalo/Facebook nào tự chạy khi không bấm.
- [ ] Trang An toàn & bản quyền mở từ popup, nội dung khớp manifest.
