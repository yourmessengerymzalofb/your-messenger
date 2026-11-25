/* Telegram in the Yahoo desktop on Zalo: a Telegram-blue buddy window fed by the Telegram Web tab
   (adapters/telegram, web.telegram.org/a/) and Yahoo chat windows mirroring the chat open there
   (source-channel.mjs does the work; this file gives Telegram's words and groups). */
import {hostSource} from './source-channel.mjs';

export const TELEGRAM_ICON='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#2aabee"/><path d="M3.4 7.7l8.3-3.2c.4-.1.7.1.6.6l-1.4 6.6c-.1.5-.4.6-.8.4l-2.1-1.6-1 1c-.1.1-.2.2-.5.2l.2-2.2 4-3.6c.2-.2 0-.2-.3-.1L5.5 9 3.4 8.3c-.5-.1-.5-.4 0-.6z" fill="#fff"/></svg>');

export function hostTelegram(root){
  return hostSource(root,{id:'telegram',label:'Telegram',icon:TELEGRAM_ICON,tab:'tab Telegram Web',
    oldTab:'Đã mở Telegram Web từ trước khi cài hay cập nhật plugin? Bấm F5 trên tab đó. Plugin dùng bản web.telegram.org/a/.',
    hint:'Hội thoại trên tab Telegram Web',search:'Tìm hội thoại Telegram...',
    // Zalo's order: Nhóm, Bạn bè, then bots last (like Zalo's OA).
    groups:{group:'Nhóm',friends:'Bạn bè',business:'Bot'},businessTitle:'Bot Telegram',calls:false,
    status:{unrecognized:'Tab Telegram không ở trang chat (cần bản web.telegram.org/a/) — bấm để xem tab'}});
}
