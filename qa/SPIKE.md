# Spike 0.1.0: kiểm khả thi trên Zalo / Facebook thật

**Trạng thái: CHƯA CHẠY.** Các test local (152/152) chỉ dùng DOM giả. Bốn câu hỏi dưới đây chỉ trả lời được trên tài khoản thật của chủ máy.

Quy tắc khi thử:
- Zalo: chỉ gửi vào **My Documents** (Cloud của tôi).
- Facebook: chỉ gửi vào hội thoại với chính mình hoặc một người đã đồng ý nhận tin thử.
- Không chụp màn hình nội dung chat của người khác.

## Chuẩn bị
1. `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn thư mục `extension/`.
2. Mở `https://yahoo-v2.racingisle5.chatgpt.site/` và đăng nhập Yahoo v2.
3. Mở tab Zalo Web (`chat.zalo.me`) và tab Facebook Messages (`facebook.com/messages`), đã đăng nhập. Nên ghim (Pin) 2 tab này.
4. Quay lại tab Yahoo v2.

## Bốn câu hỏi

| # | Kiểm tra | Cách làm | Kết quả Zalo | Kết quả FB |
|---|---|---|---|---|
| a | Mở hội thoại từ tab khác | Trong buddy list Yahoo, bấm **My Documents** (Zalo) / một hội thoại FB. Cửa sổ chat Yahoo phải hiện tin, tab gốc phải chuyển đúng hội thoại | | |
| b | Đọc tin khi tab gốc bị ẩn | Từ điện thoại, gửi một tin vào hội thoại đó. Tin phải hiện trong cửa sổ Yahoo trong vài giây mà không cần mở tab gốc | | |
| c | Chèn chữ vào editor gốc | Gõ `test hub 1` trong cửa sổ Yahoo rồi Enter. Nếu báo "không nhận nội dung" thì (c) hỏng | | |
| d | Bấm Send gốc khi tab ẩn | Tiếp bước c: tin `test hub 1` phải xuất hiện trên app thật và trên điện thoại | | |

Ghi thêm: phiên bản Chrome, thời gian tin hiện ra ở bước b, và mọi thông báo vàng trong cửa sổ Yahoo.

## Nếu (c) hoặc (d) hỏng
Phương án dự phòng trong plan: trong lúc gửi, tạm đưa tab gốc lên trước rồi trả về tab Yahoo. Cách này cần sửa `background/router.js` (focus tab trước khi forward `send`). Chỉ làm khi spike xác nhận là cần.

## Chẩn đoán nhanh
Popup của extension hiện trạng thái từng nguồn: đã kết nối, chưa đăng nhập, không nhận diện được trang, hoặc chưa mở tab. Popup chỉ hiện số hội thoại, không hiện tên.
