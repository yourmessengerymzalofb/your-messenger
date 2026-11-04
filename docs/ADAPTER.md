# Thêm một app chat web mới vào Yahoo Hub

Mỗi app chat (Zalo, Facebook, sau này Telegram Web, WhatsApp Web…) là một **adapter** chạy trong tab của chính app đó. Adapter chỉ đọc những gì trang đang hiển thị và thao tác qua control gốc. Không gọi API riêng, không đọc cookie hay token.

## 1. Hợp đồng adapter

Tạo `extension/adapters/<id>/hub-adapter.js`, đặt vào `globalThis` một object có:

| Hàm | Trả về | Ghi chú |
|---|---|---|
| `id` | `'<id>'` | Trùng với `id` trong registry |
| `read()` | `{state, entries, transcript}` | Đồng bộ, không gây side effect |
| `open(key)` | `Promise<{ok, reason}>` | Mở đúng hội thoại `key`, chờ trang xác nhận |
| `send(key, text)` | `Promise<{ok, reason}>` | Chỉ gửi khi `key` đang mở; dùng `YahooHubCompose.send` |

**`state`** nhận một trong các giá trị `ready`, `login`, `unrecognized`.

**`entries`**: `[{key, name, group, unread, avatar, time}]`
- `key` phải ổn định trong phiên: URL thread, `data-id`… Nếu trang không có id, dùng tên làm key và tách trùng bằng avatar.
- `avatar` chỉ nhận URL `https:`; giá trị khác bị loại.

**`transcript`**: `{key, title, status, canSend, messages:[{id, from:'me'|'peer', sender, text, time, kind}]}`
- `kind` thuộc `text`, `image`, `sticker`, `file`, `call`, `link`, `other`.
- Tin không phải chữ hiện thành placeholder trong hub.

Cuối file khởi động bridge:

```js
if(globalThis.chrome?.runtime?.id&&globalThis.YahooHubBridge)globalThis.YahooHubMyApp.bridge=globalThis.YahooHubBridge(globalThis.YahooHubMyApp);
```

## 2. Registry

Thêm một entry vào `extension/shared/registry.js`:

```js
{id:'telegram',label:'Telegram',openUrl:'https://web.telegram.org/a/',groups:['Friends','Group'],
 match:u=>u.origin==='https://web.telegram.org'}
```

`groups` là thứ tự các nhóm con trong buddy list.

## 3. Manifest

Thêm một block `content_scripts` với `matches` hẹp nhất có thể. Thứ tự file:

```
shared/protocol.js, shared/compose.js, shared/bridge.js, adapters/<id>/hub-adapter.js
```

Nếu adapter có skin Yahoo riêng (như Zalo/FB) thì đặt các file skin trước các file trên. Không thêm `host_permissions`, không thêm quyền mới.

## 4. Quy tắc bắt buộc

- **Một target hoặc từ chối.** Không tìm thấy đúng một row, editor hay nút Send thì trả `{ok:false, reason}`, không đoán.
- **Không tự gửi.** `open`/`send` chỉ chạy khi service worker chuyển yêu cầu từ một click hoặc Enter trusted ở hub. Không retry, không Enter giả.
- **Không ghi đè bản nháp gốc.** `YahooHubCompose.send` đã từ chối khi editor gốc đang có chữ.
- **Không lưu.** Không dùng `storage.local.set` cho dữ liệu chat, không `localStorage`/IndexedDB, không `fetch`/WebSocket.
- **Test chỉ dùng dữ liệu giả.** Thêm `tests/hub/<id>-adapter.test.mjs` theo mẫu `facebook-adapter.test.mjs`.

## 5. Kiểm thật

Ghi vào `qa/SPIKE.md` kết quả 4 bước trên app thật (mở, đọc khi tab ẩn, chèn chữ, bấm Send khi tab ẩn). Chỉ dùng hội thoại của chính bạn.
