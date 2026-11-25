/* Scoped Yahoo CSS goes into <style> elements (Zalo's style-src allows inline styles).
   The build leaves __YM_STATIC__ where packaged asset URLs belong. */
import {YM_ASSET} from './env.mjs';
const added=new Set();
export function injectCss(css,id){
  if(added.has(id))return;added.add(id);
  const style=document.createElement('style');style.dataset.ym=id;
  style.textContent=css.replaceAll('__YM_STATIC__',YM_ASSET);
  document.head.append(style);
}
// Zalo's own element rules (e.g. main{background:#fff;z-index:10}) would hit desktop nodes:
// roll every node back to browser defaults first. Scoped Yahoo rules come later and are at
// least as specific, so they still win, as they do on the Yahoo site.
export const ROOT_CSS=`
#ym-root,#ym-root *,#ym-root *::before,#ym-root *::after{all:revert}
#ym-root{position:fixed!important;inset:0!important;z-index:2147483000!important;overflow:auto;isolation:isolate;margin:0;color-scheme:light}
#ym-root.ym-away{display:none!important}
#ym-root .ym-zalo-tray{font:bold 10px Tahoma,sans-serif;color:#fff;background:#0068ff;border:1px solid #fff;border-radius:3px;padding:0 5px;height:18px;cursor:pointer}
/* Channel buddy windows (channel-window.mjs): Yahoo's buddy-window layout, channel colours. */
/* New Zalo/Facebook message (alerts.mjs): the title bar pulses like a YM! chat window's
   (also on Zalo's own conversation windows, outside #ym-root). */
#ym-root .titlebar.ym-unread-title,.titlebar.ym-unread-title{animation:yahoo-unread-pulse 1.2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){#ym-root .titlebar.ym-unread-title,.titlebar.ym-unread-title{animation:none;background:#ffe28a;color:#633b0d}}
/* "Đổi nick" by the profile name (nickname.mjs). */
#ym-root .ym-nick-change{margin:0 0 2px 4px;padding:0 5px;font:10px Tahoma,sans-serif;vertical-align:middle}
#ym-root .ym-nick-dialog input{width:100%;box-sizing:border-box;margin:4px 0}
/* Loading (Zalo and Facebook lists): a spinner on "Đang đọc…"/"Đang kết nối…", and a moving bar while
   the Zalo list scans for more conversations. */
@keyframes ym-spin{to{transform:rotate(360deg)}}
@keyframes ym-scan{from{background-position:-120px 0}to{background-position:calc(100% + 120px) 0}}
#ym-root .ym-channel-loading::before{content:'';display:inline-block;width:9px;height:9px;margin-right:6px;vertical-align:-1px;border:2px solid #d8cbec;border-top-color:#6a35b2;border-radius:50%;animation:ym-spin .8s linear infinite}
#ym-root .yzr-buddy-groups[aria-busy="true"]{position:relative}
#ym-root .yzr-buddy-groups[aria-busy="true"]::before{content:'';position:sticky;top:0;display:block;height:3px;z-index:1;background:linear-gradient(90deg,transparent,#0068ff,transparent) no-repeat;background-size:120px 3px;animation:ym-scan 1.1s linear infinite}
@media (prefers-reduced-motion:reduce){#ym-root .ym-channel-loading::before,#ym-root .yzr-buddy-groups[aria-busy="true"]::before{animation:none}}
/* Y! 360° window (y360-window.mjs): a YM! window like Messenger 9's Insider, the blog in a white panel. */
#ym-root .window.ym-y360-window{position:fixed;display:flex;flex-direction:column;left:400px;top:52px;width:620px;height:560px;max-width:calc(100vw - 16px);max-height:calc(100svh - var(--xp-bar-height,38px) - 20px)}
#ym-root .window.ym-y360-window.maximized{inset:0 0 var(--xp-bar-height,38px) 0!important;width:auto!important;height:auto!important;max-width:none;max-height:none;border-radius:0}
#ym-root .ym-y360-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px;padding:6px;background:linear-gradient(#f3eefa,#e6dcf3)}
#ym-root .ym-y360-panel{flex:1;min-height:0;display:flex;border:1px solid #c9bde0;border-radius:6px;background:#fff;overflow:hidden;box-shadow:inset 0 1px 2px #0001}
#ym-root .ym-y360-frame{flex:1;min-width:0;min-height:0;border:0;background:#fff}
#ym-root .ym-y360-links{display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #c9bde0;border-radius:6px;background:#fff;font:11px Tahoma,sans-serif;color:#7a6a96}
#ym-root .ym-y360-badge{width:20px;height:20px}
#ym-root .ym-y360-link{padding:0;border:0;background:none;color:#1d4ea8;font:11px Tahoma,sans-serif;cursor:pointer;text-decoration:none}
#ym-root .ym-y360-link:hover{text-decoration:underline}
#ym-root .ym-buddy-content{display:flex;flex-direction:column;flex:1;min-height:0}
#ym-root .ym-channel-window .my-profile{align-items:center}
#ym-root .ym-channel-window .my-avatar img{width:100%;height:100%;object-fit:cover}
#ym-root .ym-channel-note{display:block;color:#777;font:11px Tahoma,sans-serif}
#ym-root .ym-channel-window .contact-search input{width:100%}
#ym-root .ym-channel-hint{padding:6px 12px;color:#777;font:italic 11px Tahoma,sans-serif}
#ym-root .ym-channel-hint[hidden]{display:none}
/* The skin's list section carries Yahoo's .contacts class (a scroll box of its own): let it grow.
   !important: Yahoo's later ".buddies .contacts" rule (height:0) has the same specificity. */
#ym-root .ym-channel-slot>.contacts{flex:none!important;overflow:visible!important;height:auto!important;min-height:0!important;max-height:none;margin:0;padding:0;border:0;background:none;box-shadow:none}
#ym-root .ym-channel-window .yzr-list-footer{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:4px 8px}
#ym-root .ym-channel-window .yzr-list-error{flex-basis:100%;margin:0;color:#b00020;font-size:11px}
/* Names are not "offline" grey; a round badge on each avatar names the channel
   (in its own window, or as a source in the combined buddy list). */
#ym-root :is(.ym-channel-window,.ym-channel-source) .contact-row.contact-row b{color:inherit}
#ym-root :is(.ym-channel-window,.ym-channel-source) .tiny-avatar{position:relative;overflow:visible}
#ym-root :is(.ym-channel-window,.ym-channel-source) .tiny-avatar::after{position:absolute;right:-4px;bottom:-4px;width:12px;height:12px;border:1px solid #fff;border-radius:50%;font:bold 8px/12px Tahoma,sans-serif;color:#fff;text-align:center}
#ym-root :is(.ym-zalo-window,.ym-src-zalo) .tiny-avatar::after{content:'Z';background:#0068ff}
/* Rows without a picture (My Documents, the strangers folder) get an icon, so they read as rows. */
#ym-root :is(.ym-channel-window,.ym-channel-source) .yzr-avatar-icon{display:inline-flex;align-items:center;justify-content:center;background:#e3efff;color:#0b3d91;font:13px/1 Tahoma,sans-serif}
#ym-root :is(.ym-channel-window,.ym-channel-source) .yzr-avatar-icon[data-yzr-icon=cloud]::before{content:'☁'}
#ym-root :is(.ym-channel-window,.ym-channel-source) .yzr-avatar-icon[data-yzr-icon=strangers]::before{content:'✉'}
#ym-root :is(.ym-channel-window,.ym-channel-source) .yzr-avatar-icon[data-yzr-icon=person]::before{content:'☺'}
#ym-root :is(.ym-channel-window,.ym-channel-source) :is(.yzr-more-groups,.ym-more){display:block;margin:3px auto 6px;padding:1px 10px;font-size:11px}
/* Zalo's own filter (e.g. "Người lạ") is on: a note with the way back to the full list. */
#ym-root .yzr-filter-bar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:4px 6px;padding:4px 6px;border:1px solid #e4d79a;border-radius:3px;background:#fff8d8;color:#5d4a00;font:11px Tahoma,sans-serif}
#ym-root .yzr-filter-bar[hidden]{display:none}
#ym-root .yzr-filter-bar button{padding:1px 8px;font-size:11px}
#ym-root :is(.ym-facebook-window,.ym-src-facebook) .tiny-avatar::after{content:'f';background:#1b3f8f}
#ym-root :is(.ym-telegram-window,.ym-src-telegram) .tiny-avatar::after{content:'➤';background:#2aabee;font-size:7px}
/* Zalo: Zalo blue with a light-blue menu; Facebook: dark blue. Yahoo stays purple. */
#ym-root .ym-zalo-window{--title1:#cfe4ff;--title2:#0068ff;--title3:#62a6ff;border-color:#5b8fd6}
#ym-root .ym-zalo-window>.titlebar{background:linear-gradient(var(--title1),var(--title2) 48%,#2f86ff 72%,var(--title3));border-top-color:#e3efff}
#ym-root .ym-zalo-window .my-profile{background:linear-gradient(#f3f8ff,#e3efff)}
#ym-root :is(.ym-zalo-window,.ym-src-zalo) summary{color:#0b3d91}
#ym-root :is(.ym-zalo-window,.ym-src-zalo) .contact-unread{background:#0068ff;border-color:#0068ff;color:#fff}
#ym-root .ym-zalo-window .contact-search input{border-color:#8fb4e6}
#ym-root .ym-zalo-window .contact-search input:focus{border-color:#0068ff;outline-color:#0068ff}
#ym-root .ym-facebook-window{--title1:#8ea6d8;--title2:#1b3f8f;--title3:#3b5998;border-color:#29487d}
#ym-root .ym-facebook-window>.titlebar{background:linear-gradient(var(--title1),var(--title2) 48%,#29487d 72%,var(--title3));border-top-color:#c6d3ee}
#ym-root .ym-facebook-window .my-profile{background:linear-gradient(#f5f7fb,#e4e9f4)}
#ym-root :is(.ym-facebook-window,.ym-src-facebook) summary{color:#1b3f8f}
#ym-root :is(.ym-facebook-window,.ym-src-facebook) .contact-unread{background:#1b3f8f;border-color:#1b3f8f;color:#fff}
#ym-root .ym-facebook-window .contact-search input{border-color:#8ea6d8}
/* Telegram: Telegram blue. */
#ym-root .ym-telegram-window{--title1:#a9dcf7;--title2:#1c93d3;--title3:#3fb0ec;border-color:#1b7fb6}
#ym-root .ym-telegram-window>.titlebar{background:linear-gradient(var(--title1),var(--title2) 48%,#1b7fb6 72%,var(--title3));border-top-color:#d4eefc}
#ym-root .ym-telegram-window .my-profile{background:linear-gradient(#f3fafe,#dcf0fb)}
#ym-root :is(.ym-telegram-window,.ym-src-telegram) summary{color:#1677ad}
#ym-root :is(.ym-telegram-window,.ym-src-telegram) .contact-unread{background:#2aabee;border-color:#2aabee;color:#fff}
#ym-root .ym-telegram-window .contact-search input{border-color:#a9dcf7}
#ym-root .ym-channel-status{display:block;width:100%;margin:0;padding:8px 12px;border:0;background:none;text-align:left;color:#555;font:italic 11px Tahoma,sans-serif;cursor:pointer}
#ym-root .ym-channel-status:hover{background:#eef2fa;color:#1b3f8f}
/* Combined buddy list (buddy-tabs.mjs): a tab per app in Yahoo's buddy window, one scroll box. */
#ym-root .ym-buddy-tabs{display:flex;flex-shrink:0;gap:2px;margin:3px 5px 0;border-bottom:1px solid #b7a4c7}
#ym-root .ym-buddy-tab{display:flex;flex:1 1 auto;align-items:center;justify-content:center;gap:3px;min-width:0;margin-bottom:-1px;padding:3px 4px;border:1px solid #b7a4c7;border-radius:3px 3px 0 0;background:linear-gradient(#fff,#e5e4dc);color:#7a6a8c;font:10px Tahoma,sans-serif;white-space:nowrap;cursor:pointer}
#ym-root .ym-buddy-tab[aria-selected=true]{background:#fff;border-bottom-color:#fff;color:#4b2a78;font-weight:bold}
#ym-root .ym-buddy-tab img{width:12px;height:12px;flex-shrink:0}
#ym-root .ym-buddy-tab>span:not(.ym-tab-unread){overflow:hidden;text-overflow:ellipsis}
/* 282px is too narrow for four labels: an app tab shows its name only while selected. */
#ym-root .ym-buddy-tab[data-tab=all],#ym-root .ym-buddy-tab[aria-selected=true]{flex-grow:2}
#ym-root .ym-buddy-tab:not([data-tab=all]):not([aria-selected=true])>span:not(.ym-tab-unread){display:none}
#ym-root .ym-tab-unread{min-width:13px;padding:0 3px;border-radius:7px;background:#d93025;color:#fff;font:bold 9px/13px Tahoma,sans-serif;text-align:center}
#ym-root .ym-tab-unread[hidden],#ym-root .ym-source[hidden],#ym-root .ym-source-head[hidden]{display:none}
/* Tất cả opens a list of apps to show in it; the arrow turns red while some are left out. */
#ym-root .ym-buddy-tab[data-tab=all]::after{content:"▾";font-size:9px}
#ym-root .ym-buddy-tab[data-ym-filtered]::after{color:#d93025}
#ym-root .ym-app-anchor{position:relative;z-index:30;height:0}
#ym-root .ym-app-picker{position:absolute;top:0;left:5px;min-width:140px;padding:3px 0;border:1px solid #8f7aa6;background:#fff;box-shadow:2px 2px 5px rgba(0,0,0,.25);font:11px Tahoma,sans-serif}
#ym-root .ym-app-picker[hidden]{display:none}
#ym-root .ym-app-picker-title{padding:2px 8px 3px;color:#7a6a8c;font-size:10px}
#ym-root .ym-app-pick{display:flex;align-items:center;gap:5px;padding:3px 8px;color:#333;cursor:pointer}
#ym-root .ym-app-pick:hover{background:#e8def3}
#ym-root .ym-app-pick input{margin:0}
#ym-root .ym-app-pick img{width:14px;height:14px}
#ym-root .ym-combined{margin-top:0}
#ym-root .ym-combined .ym-source>.contacts{flex:none!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0;border:0!important;background:none;box-shadow:none;overflow:visible!important}
#ym-root .ym-source-head{display:flex;align-items:center;gap:5px;width:100%;margin:0;padding:4px 6px;border:0;border-bottom:1px solid #d9cfe6;background:linear-gradient(#f6f1fb,#e8def3);color:#5b338e;font:bold 11px Tahoma,sans-serif;text-align:left;cursor:pointer}
#ym-root .ym-source-head img{width:14px;height:14px}
#ym-root .ym-src-zalo>.ym-source-head{background:linear-gradient(#f3f8ff,#e3efff);color:#0b3d91;border-bottom-color:#c4dafa}
#ym-root .ym-src-facebook>.ym-source-head{background:linear-gradient(#f5f7fb,#e4e9f4);color:#1b3f8f;border-bottom-color:#c6d3ee}
#ym-root .ym-src-telegram>.ym-source-head{background:linear-gradient(#f3fafe,#dcf0fb);color:#1677ad;border-bottom-color:#bfe4f8}
/* Folded app in Tất cả: only its heading stays. */
/* Folding is for Tất cả only: a single-app tab always shows that app. */
#ym-root .ym-combined[data-tab="all"] .ym-source[data-folded]>:not(.ym-source-head){display:none}
/* Chưa đọc also sits on the Zalo, Facebook and Telegram tabs, and folds there too. */
#ym-root .ym-combined .ym-unread-source[data-folded]>:not(.ym-source-head){display:none}
#ym-root .ym-fold{display:inline-block;width:9px;font-size:9px;transition:transform .15s}
#ym-root .ym-source[data-folded] .ym-fold{transform:rotate(-90deg)}
/* Chưa đọc: copies of unread rows from every app, each with its app badge. */
#ym-root .ym-unread-source[hidden]{display:none}
#ym-root .ym-unread-head{display:flex;padding:4px 8px;background:linear-gradient(#fff4e5,#ffe2bd);color:#8a4b00;border-bottom-color:#f2c48d;cursor:pointer}
#ym-root .ym-combined .ym-unread-list{flex:none!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;margin:0!important;border:0!important}
#ym-root .ym-unread-row .tiny-avatar{position:relative;overflow:visible}
#ym-root .ym-unread-row .tiny-avatar::after{position:absolute;right:-4px;bottom:-4px;width:12px;height:12px;border:1px solid #fff;border-radius:50%;font:bold 8px/12px Tahoma,sans-serif;color:#fff;text-align:center}
#ym-root .ym-unread-row[data-app=yahoo] .tiny-avatar::after{content:'Y';background:#6a35b2}
#ym-root .ym-unread-row[data-app=zalo] .tiny-avatar::after{content:'Z';background:#0068ff}
#ym-root .ym-unread-row[data-app=facebook] .tiny-avatar::after{content:'f';background:#1b3f8f}
#ym-root .ym-unread-row[data-app=telegram] .tiny-avatar::after{content:'➤';background:#2aabee;font-size:7px}
#ym-root .ym-unread-row.contact-row b{color:inherit}
#ym-root .ym-combined .contact-row[data-ym-unread-attention] .contact-first b{
  background-color:#ffe28a;color:#432c0d;border-radius:2px;animation:ym-contact-unread-pulse 1.4s ease-in-out infinite
}
@keyframes ym-contact-unread-pulse{50%{background-color:#fff6dc}}
@media (prefers-reduced-motion:reduce){
  #ym-root .ym-combined .contact-row[data-ym-unread-attention] .contact-first b{animation:none}
}
#ym-root .ym-join-note{color:#888;font-size:10px}
#ym-root .ym-combined[data-tab=all] .ym-src-yahoo .tiny-avatar{position:relative;overflow:visible}
#ym-root .ym-combined[data-tab=all] .ym-src-yahoo .tiny-avatar::after{content:'Y';position:absolute;right:-4px;bottom:-4px;width:12px;height:12px;border:1px solid #fff;border-radius:50%;background:#6a35b2;color:#fff;font:bold 8px/12px Tahoma,sans-serif;text-align:center}
/* Signed out (boot.mjs guest mode): Yahoo's sign-in window hides until asked for; the Yahoo list
   of the guest window holds the one-click sign-up (quick-id.mjs). */
#ym-root[data-ym-guest]:not([data-ym-auth]) #auth-screen{display:none!important}
#ym-root:not([data-ym-guest]) .ym-auth-later{display:none}
#ym-root .ym-yahoo-join{display:flex;flex-direction:column;gap:6px;margin:6px 8px;padding:8px 10px;border:1px solid #b7a4c7;border-radius:4px;background:linear-gradient(#fff,#f3eefa);color:#333;font:11px Tahoma,sans-serif}
#ym-root .ym-yahoo-join>b{color:#5b338e;font-size:12px}
#ym-root .ym-yahoo-join p{margin:0}
#ym-root .ym-yahoo-join small{color:#666}
#ym-root .ym-quick-id{display:flex;flex-direction:column;gap:5px}
#ym-root .ym-quick-row{display:flex;gap:4px;align-items:center}
#ym-root .ym-quick-row input{flex:1;min-width:0}
#ym-root .ym-yahoo-join .error{color:#b00020}
#ym-root .ym-yahoo-join .error:empty{display:none}
#ym-root .ym-yahoo-join .login-link{align-self:center}
#ym-root :is(.ym-quick-id,.ym-quick-login)[hidden]{display:none}
#ym-root .ym-quick-dialog{position:fixed;inset:0;width:320px;height:fit-content;margin:auto;padding:0;border:1px solid #5b338e;border-radius:6px 6px 3px 3px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.35)}
#ym-root .ym-quick-dialog>.titlebar{display:flex;justify-content:space-between;align-items:center;padding:4px 6px 4px 10px;background:linear-gradient(#a98ad3,#5b338e);color:#fff;font:bold 12px Tahoma,sans-serif}
#ym-root .ym-quick-dialog>.titlebar button{padding:0 6px;border:1px solid #fff;border-radius:3px;background:#c0392b;color:#fff;font:bold 12px Tahoma,sans-serif;cursor:pointer}
#ym-root .ym-quick-done{padding:8px 12px;font:11px Tahoma,sans-serif}
#ym-root .ym-quick-done p{margin:4px 0}
/* First-run terms (terms.mjs): wider than the ID dialogs, a numbered list. */
#ym-root .ym-terms-dialog{width:min(480px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto}
#ym-root .ym-terms ol{margin:6px 0;padding-left:20px}
#ym-root .ym-terms li{margin:5px 0;line-height:1.45}
#ym-root .ym-terms b{color:#5b338e}
#ym-root .ym-terms .login-link{display:block;margin:6px 0}
#ym-root .ym-quick-password{display:block;margin:6px 0;padding:5px 8px;border:1px dashed #b7a4c7;background:#f6f1fb;font:bold 14px Consolas,monospace;letter-spacing:1px;user-select:all}
#ym-root .ym-quick-actions{display:flex;gap:6px;justify-content:flex-end}
/* Facebook chat windows: Yahoo's chat window in Facebook dark blue. */
#ym-root .ym-facebook-chat{--title1:#8ea6d8;--title2:#1b3f8f;--title3:#3b5998;--purple:#1b3f8f;--light:#8ea6d8;border-color:#29487d}
#ym-root .ym-facebook-chat>.titlebar{background:linear-gradient(var(--title1),var(--title2) 48%,#29487d 72%,var(--title3));border-top-color:#c6d3ee}
#ym-root .ym-facebook-chat .menubar{background:linear-gradient(#eef2fa,#dfe6f4);border-bottom-color:#8ea6d8}
#ym-root .ym-facebook-chat .menubar button{color:#1b3f8f}
#ym-root .ym-facebook-chat .sender:not(.me){color:#1b3f8f}
#ym-root .group-actions[hidden]{display:none!important}
/* Zalo's own dialogs (Tạo nhóm, Thêm bạn…) open from the Yahoo desktop: show them above it. */
body>.zl-modal{z-index:2147483200!important}
#ym-root .ym-source-chat .ym-src-photos{display:block;margin:3px 0 2px}
#ym-root .ym-source-chat .ym-src-photos img{max-width:220px;max-height:180px;margin:0 4px 4px 0;border:1px solid #c9c9c9;border-radius:3px;vertical-align:top;background:#f4f4f4}
#ym-root .ym-source-chat .ym-reveal{margin-left:auto}
#ym-root .ym-source-chat .ym-placeholder{color:#6d7fa8;font-style:italic}
/* Pictures pasted in a Facebook chat window, waiting above the text box until Send. */
#ym-root .ym-source-chat .ym-paste-tray{flex:none;padding:4px 8px 6px;border-top:1px solid #d8d8d0;background:#fbfbf7;font:11px Tahoma,sans-serif;color:#333}
#ym-root .ym-source-chat .ym-paste-tray[hidden]{display:none}
#ym-root .ym-source-chat .ym-paste-head{display:flex;align-items:center;gap:4px;margin-bottom:4px}
#ym-root .ym-source-chat .ym-paste-head .mini-button{margin-left:auto}
#ym-root .ym-source-chat .ym-paste-list{display:flex;gap:6px;overflow-x:auto}
#ym-root .ym-source-chat .ym-paste-item{position:relative;flex:none}
#ym-root .ym-source-chat .ym-paste-item img{display:block;width:64px;height:64px;object-fit:cover;border:1px solid #c9c9c9;border-radius:3px;background:#f4f4f4}
#ym-root .ym-source-chat .ym-paste-remove{position:absolute;top:2px;right:2px;width:16px;height:16px;padding:0;border:1px solid #888;border-radius:50%;background:#fff;color:#333;font:bold 11px/13px Arial,sans-serif;cursor:pointer}
/* Facebook and Telegram text at 13px Arial, as YM shows a message at its default size ("10"); names at 15px like YM's. */
#ym-root .ym-source-chat .messages .message-body{font:13px Arial,sans-serif}
/* Telegram chat windows: Yahoo's chat window in Telegram blue. */
#ym-root .ym-telegram-chat{--title1:#a9dcf7;--title2:#1c93d3;--title3:#3fb0ec;--purple:#1677ad;--light:#a9dcf7;border-color:#1b7fb6}
#ym-root .ym-telegram-chat>.titlebar{background:linear-gradient(var(--title1),var(--title2) 48%,#1b7fb6 72%,var(--title3));border-top-color:#d4eefc}
#ym-root .ym-telegram-chat .menubar{background:linear-gradient(#eff8fe,#dcf0fb);border-bottom-color:#a9dcf7}
#ym-root .ym-telegram-chat .menubar button{color:#1677ad}
#ym-root .ym-telegram-chat .sender:not(.me){color:#1677ad}
/* Chat text can be selected and copied (Zalo's page turns selection off for what it does not mark). */
#ym-root .messages,#ym-root .messages .message-line,#ym-root .messages .message-line *{-webkit-user-select:text;user-select:text}
#ym-root .messages .message-line button{-webkit-user-select:none;user-select:none}
#ym-root .messages a.ym-chat-link{color:#0645ad;text-decoration:underline;cursor:pointer;overflow-wrap:anywhere}
#ym-root .messages a.ym-chat-link:visited{color:#5a2a9c}
#ym-root .ym-mirror-notice{display:flex;align-items:center;gap:8px;padding:5px 8px;background:#fff8d8;border-bottom:1px solid #e4d79a;color:#5d4a00;font:11px Tahoma,sans-serif}
#ym-root .ym-mirror-notice[hidden]{display:none}
.ym-return{all:revert;position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147483000;width:26px;height:56px;padding:0;border:2px solid #fff;border-right:0;border-radius:8px 0 0 8px;background:#6134ad;color:#fff;font:bold 12px Tahoma,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer;opacity:.85}
.ym-return:hover{opacity:1}
.ym-return[hidden]{display:none}
`;
