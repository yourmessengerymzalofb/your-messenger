/* The RTS shortcuts (StarCraft, Warcraft III…) play on vivalarts.com in a desktop window. Zalo's CSP
   frames none of that site, only this extension's pages, so the window's frame shows yahoo/game.html,
   which frames the game site. Zalo removes iframes whose src is a chrome-extension:// URL, so the
   frame keeps no src and is navigated there instead (as in y360-window.mjs). */
export const GAME_PAGE=()=>globalThis.chrome?.runtime?.getURL?.('yahoo/game.html')||'game.html';
export function ymGameFrame(frame,url){
  frame.dataset.ymUrl=url;
  try{frame.contentWindow?.location.replace(GAME_PAGE()+'#'+encodeURIComponent(url));}catch{}
}
