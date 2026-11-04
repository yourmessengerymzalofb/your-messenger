# Bài post 0.3.0 beta: chốt phương án B, có tùy chọn A, điều khoản, an toàn, mã nguồn trên GitHub

Ảnh đính kèm (theo thứ tự, trong thư mục này):

1. `1-mac-dinh-B-gom-chung-tab.png`: toàn màn hình, giao diện mặc định (phương án B, tab Tất cả).
2. `2-B-can-canh.png`: cận cảnh danh sách bạn: tab Tất cả / Y! / Zalo / Facebook, mục "Chưa đọc", số tin chưa đọc trên từng tab.
3. `3-B-tab-zalo-can-canh.png`: cận cảnh khi bấm tab Zalo.
4. `4-tuy-chon-A-tach-rieng.png`: tùy chọn phương án A, mỗi app một cửa sổ.
5. `5-popup-chon-giao-dien.png`: popup của plugin, nơi chọn B hoặc A và ẩn từng app.
6. `6-dieu-khoan-lan-dau.png`: trang điều khoản hiện ra ngay khi cài.
7. `7-dieu-khoan-tren-zalo.png`: hộp điều khoản trên Zalo Web, cho ai đóng trang cài đặt mà chưa chọn.
8. `8a-an-toan-lam-gi-khong-lam-gi.png`: trang "An toàn & bản quyền", phần plugin làm gì và không làm gì.
9. `8b-an-toan-quyen-tu-kiem-tra.png`: phần quyền plugin xin Chrome và cách tự kiểm tra.

Ảnh 1–4 chụp từ chính bản build 0.3.0, chạy trên một trang dựng thử với dữ liệu giả: mọi tên, avatar và nhóm đều do mình đặt, không có tài khoản thật nào.

**Trước khi đăng, kiểm tra 3 điều:**
- Repo `github.com/yourmessengerymzalofb/your-messenger` đã để **Public**. Lúc soạn bài, link này vẫn trả về 404 với người ngoài.
- README và trang `safety.html` (mục "Tự kiểm tra", bước 4) đang ghi repo là riêng tư, chỉ chia sẻ cho người kiểm tra độc lập. Nếu để public thì sửa hai chỗ này cho khớp.
- Link tải bản beta trong nhóm (thay `[link tải]` bên dưới).

Repo trên GitHub không có `vendor/yahoo-v2` (client và tài nguyên YM v2) và `fixtures/zalo/reference`. Bài nói rõ điều này, và chỉ hứa SHA-256 để đối chiếu đúng file tải, không hứa build lại được từ repo.

Lúc chụp ảnh, mình phát hiện và sửa một lỗi nhỏ: người Zalo "đang truy cập" vẫn hiện chấm xám trong danh sách (thiếu class `online`). Bản sửa đã có trong commit `a26bb41` và trên GitHub (`0cf5559`); ảnh 3 và 4 có chấm vàng đúng.

---

🟣 **BUZZ!!! Your Messenger 0.3.0 beta: chốt phương án B, vẫn có A cho ai thích tách riêng, và mã nguồn đã lên GitHub** 🟣

Cảm ơn anh em đã vote ở bài trước! Mình đọc hết 327 bình luận và trả lời. Kết quả:
🅱️ Gom chung: 109 người (56%)
🅰️ Tách riêng: 69 người (36%)
📑 Một cửa sổ, chia tab theo app: 9 người
🔀 Gom chung nhưng có tùy chọn tách: 6 người
→ Tính cả B và hai biến thể của nó, 64% anh em muốn **một cửa sổ**.

✅ **Quyết định: phương án B là giao diện mặc định, chia tab theo từng app** (ảnh 1–3)
Một danh sách bạn YM! duy nhất, phía trên có tab **Tất cả / Y! / Zalo / Facebook**, mỗi tab có số tin chưa đọc. Tab "Tất cả" có mục **Chưa đọc** gom tin chưa đọc của mọi app lên đầu. Bấm vào tiêu đề từng app để thu gọn lại cho đỡ dài, đúng góp ý "B dài quá lướt mệt" của vài anh em.

🔀 **Phương án A vẫn có, dạng tùy chọn** (ảnh 4–5)
Thú thật mình hơi tham lam, muốn cover hết nhu cầu anh em 😅 Ai thích mỗi app một cửa sổ riêng thì vào popup của plugin, chọn "3 cửa sổ riêng, mỗi app một cửa sổ". Không dùng Zalo hay Facebook thì bỏ tick app đó cho gọn.

🔒 **Về an toàn và quyền riêng tư** (nhiều anh em hỏi, mình trả lời thẳng)
Lần đầu cài, plugin hiện **điều khoản** để anh em đọc và bấm đồng ý (ảnh 6–7). Không đồng ý thì desktop tắt, Zalo giữ nguyên giao diện gốc. Trang **"An toàn & bản quyền"** ghi rõ plugin làm gì và không làm gì (ảnh 8a–8b):
• Plugin chỉ đọc nội dung **đang hiện** trên Zalo Web và Facebook để vẽ lại giao diện, ngay trong trình duyệt của bạn.
• **Không** gửi tin nhắn, danh bạ, ảnh Zalo/Facebook đi đâu. **Không** gọi API của Zalo hay Facebook.
• **Không** hỏi, không đọc mật khẩu Zalo/Facebook. Plugin không chạy trên trang đăng nhập của Zalo.
• **Không** tự gửi tin, tự bấm hay tự kết bạn. Mọi thao tác đều do chính bạn bấm.
• Mạng chỉ dùng để nối với máy chủ YM v2 (đăng nhập Y!, BUZZ, game, bạn Y!).
• Có hướng dẫn **tự kiểm tra**: xem quyền ở `chrome://extensions`, bấm F12 → Network để thấy plugin chỉ gọi tới máy chủ YM v2.

💻 **Mã nguồn đã công khai trên GitHub**
Mấy anh em lo "ông chế cài mã đọc trộm tin nhắn", mình hiểu, nên đưa luôn mã nguồn bản này lên GitHub để ai cũng đọc được:
👉 https://github.com/yourmessengerymzalofb/your-messenger
• Có đủ phần đáng lo nhất: đoạn đọc Zalo/Facebook, cổng mạng (chỉ cho đi tới máy chủ YM v2), danh sách quyền trong manifest. Mã đọc được, không làm rối, kèm bộ test tự động.
• Giao diện YM v2 bên trong là client của trang YM v2, không nằm trong repo này.
• Mỗi bản phát hành kèm mã **SHA-256**: đối chiếu để chắc file bạn tải đúng là file đăng trong nhóm, không bị ai sửa.
• Giấy phép **PolyForm Noncommercial**: xem, sửa, dùng thoải mái cho mục đích cá nhân, phi thương mại. Không bán, không đem đi kinh doanh.

✨ **Có gì mới từ bài trước**
• Đổi tên thành **Your Messenger**, chữ trong giao diện là YM! / Y!. Đây là dự án hoài niệm, phi thương mại, không liên kết với Yahoo, Zalo hay Meta.
• Tin Zalo/Facebook tới có tiếng "chimeup" và cửa sổ, taskbar nhấp nháy y như YM! ngày xưa.
• Chấm vàng online cho Facebook "Active now", và cho bạn Zalo/Facebook vừa hoạt động trong 10 phút.
• Zalo tách riêng nhóm **OA** (tài khoản doanh nghiệp có tích xanh như nhà thuốc, hãng bay) xuống cuối danh sách.
• Y!360 mở ngay trong một cửa sổ YM! cạnh danh sách bạn. BUZZ, chơi cờ vua, cờ tướng, bida với máy hoặc với bạn bè Y!.
• Tìm bạn không cần gõ dấu: gõ "hang" vẫn ra "Hằng".

📥 **Dùng thử bản beta**
Bản thử nghiệm **lưu hành nội bộ nhóm**, cài từ link chính thức trong nhóm: [link tải]. Hướng dẫn cài có trong file đi kèm (bật Developer mode → Load unpacked). Đăng nhập Zalo Web và Facebook như bình thường trước, rồi mới mở plugin.

Telegram, WhatsApp, Viber… mình đã ghi nhận hết, làm từ từ nha 🙏 Gặp lỗi gì cứ comment kèm ảnh chụp, mình sửa.

(Ảnh minh họa dùng dữ liệu giả để bảo vệ thông tin bạn bè. Dự án cá nhân, hoài niệm, phi thương mại; không liên kết với Yahoo, Zalo hay Meta. Tên và hình Yahoo thuộc về chủ sở hữu.)

#vibecoding #chromeextension #yourmessenger #yahoomessenger #zalo #hoainiem #opensource
