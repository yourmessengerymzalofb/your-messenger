# Nguồn, ghi công và giấy phép

Required Notice: Copyright (c) 2026 Nguyen Hung

## Giấy phép

- Mã nguồn của plugin (thư mục `src/`, `extension/`, `scripts/`, `tests/`, `docs/`) dùng giấy phép **PolyForm Noncommercial 1.0.0** ([LICENSE.md](LICENSE.md)): được đọc, tự build và dùng cho mục đích phi thương mại; không được bán hay phát hành lại để kiếm tiền.
- **Client YM v2 không thuộc giấy phép này: Copyright (c) 2026 Nguyen Hung, giữ mọi quyền (All rights reserved).** Mã client YM v2 và bảng style của nó không có trong repo công khai. Chúng chỉ được phát hành bên trong gói plugin, gồm client đã build (`extension/yahoo/app/`, `extension/yahoo/static/`) và bảng style YM v2 cho skin Zalo (`extension/adapters/zalo/vendor/v2.css`), để plugin chạy; không được tách ra, sao chép hay dùng riêng.
- **Không thuộc giấy phép này:** tên, logo, âm thanh, emoticon và hình ảnh Yahoo (trong client YM v2 và `extension/adapters/zalo/assets/`), hình nền Bliss của Windows XP, biểu tượng Winamp. Chúng thuộc về chủ sở hữu tương ứng và chỉ nằm ở đây để dự án hoài niệm chạy được; chủ sở hữu yêu cầu thì gỡ ngay.
- Your Messenger không liên kết với Yahoo, Zalo (VNG) hay Meta.

## Nguồn

- **YM v2** (hub): `../game-spectators-release-20261027`, commit `321e4f7` (nối tiếp `game-ui-release-20261027` @ `21fce76`), hosted tại `https://chat.ymvn.site`.
  - Extension không sửa và không deploy lại YM v2. Phần hub chỉ chèn thêm nhóm và cửa sổ vào trang.
  - Ảnh `/assets/happy.gif` được lấy từ chính site đó.
- **YM Retro for Zalo 0.2.7**: `../yahoo-zalo-extension/extension`, copy vào `extension/adapters/zalo/`.
  - Chỉ đổi đường dẫn assets.
  - Tests nằm ở `tests/zalo/`, fixtures ở `fixtures/zalo/`.
- **YM Retro for Facebook 0.6.0**: `../yahoo-facebook-extension/extension`, copy vào `extension/adapters/facebook/`.
  - Chỉ đổi đường dẫn assets và storage key `enabled` → `yfrEnabled`.
  - Tests nằm ở `tests/facebook/`.
- Âm thanh, emoticon và hình Yahoo thuộc về chủ sở hữu tương ứng, như ghi chú trong các dự án nguồn.
- `reference/` giữ popup và manifest gốc của 2 extension để đối chiếu.
