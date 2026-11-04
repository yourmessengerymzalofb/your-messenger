# Spike 0.2: Yahoo v2 chạy qua plugin (Chrome thật, 31/10/2026)

Server: `https://yahoo-v2.racingisle5.chatgpt.site`. Plugin unpacked 0.2.0, chạy trên Chrome của chủ dự án, đang đăng nhập Yahoo v2. Trang kiểm tra chỉ in mã trạng thái và cờ đăng nhập, không in dữ liệu cá nhân.

| # | Câu hỏi | Kết quả | Kết luận |
|---|---|---|---|
| a | GET `/api/account` qua service worker có mang cookie `SameSite=Lax` không | `200 authenticated=true hasProfile=true` | **ĐẠT.** Phiên đăng nhập dùng được từ plugin. |
| b | POST `/api/pulse` với Origin ghi đè bằng DNR có qua kiểm tra CSRF không | `200 ok` | **ĐẠT.** Không cần sửa hay deploy server. |
| c | Đăng nhập bằng POST `auth/login` qua SW có lưu cookie không | Chưa thử (không đăng nhập thay chủ dự án) | Suy từ (a) và (b): cookie đi được theo cả hai chiều. Thử thật ở P1 khi chủ dự án tự đăng nhập. |
| d | WebSocket realtime từ SW có nhận `ready` không | Ticket `200 enabled=true`; probe https cùng đường dẫn `426`; socket `error`, đóng `1006` | **CHƯA ĐẠT.** Xem phân tích bên dưới. |
| e1 | Content script trên `chat.zalo.me` `import()` module và chunk của plugin | `ok` | **ĐẠT.** Bundle ESM có splitting chạy được. |
| e2 | Chèn `<style>` vào trang Zalo | `true` | **ĐẠT.** Nạp CSS đã scope bằng thẻ `<style>`. |
| e3 | Proxy từ Zalo tới Yahoo v2 | `200 authenticated=true` | **ĐẠT.** |
| e4 | YouTube embed `enablejsapi=1` điều khiển bằng postMessage | `onReady`, `playerState=1` (đang phát) | **ĐẠT.** Winamp dùng shim postMessage thay `iframe_api`. |

## Phân tích (d)

- Probe `426` nghĩa là worker nhận Origin đã ghi đè cho request https thường (nếu sai Origin thì sẽ ra `403`).
- Socket thật vẫn hỏng ngay khi bắt tay, dù đã có quyền `wss://*.workers.dev/*` và luật DNR cho resourceType `websocket`. Như vậy nhiều khả năng Chrome không áp luật `modifyHeaders` cho header `Origin` của request bắt tay WebSocket. Durable Object chỉ trả lỗi khác (429) khi có từ 80 kết nối, nên khó có nguyên nhân khác.
- **Ảnh hưởng:** realtime là tùy chọn. Client Yahoo v2 vẫn polling làm nền, nên tin chỉ đến chậm hơn.
- **Hướng xử lý (để P4, cần chủ dự án duyệt):**
  1. Thêm `https://chat.zalo.me` vào `ALLOWED_ORIGINS` của realtime worker, rồi mở socket từ content script trên Zalo. Cần deploy worker và phải kiểm thêm CSP `connect-src` của Zalo.
  2. Nếu không deploy: dùng polling.

## Kết luận

Hướng "Zalo làm nền, port Yahoo v2 vào plugin" khả thi mà không phải sửa server. Sang P1 (desktop Yahoo trên Zalo). Realtime dùng polling cho đến khi chủ dự án quyết định có deploy worker hay không.
