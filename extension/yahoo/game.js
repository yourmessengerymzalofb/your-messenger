/* RTS games inside the desktop on chat.zalo.me (src/yahoo/game-frame.mjs). Zalo's CSP lets the page
   frame this extension page but not the game site, so this page frames the address in its hash.
   Only the game site the YM v2 client links (https://vivalarts.com/) is shown. */
const GAMES=['https://vivalarts.com'];
function game(hash){
  try{const url=new URL(decodeURIComponent(hash.slice(1)));return GAMES.includes(url.origin)&&url.protocol==='https:'?url.href:null;}
  catch{return null;}
}
function show(){
  const url=game(location.hash),frame=document.querySelector('iframe');
  if(url)frame.src=url;else frame.removeAttribute('src');
  document.body.toggleAttribute('data-bad',!url);
}
addEventListener('hashchange',show);show();
