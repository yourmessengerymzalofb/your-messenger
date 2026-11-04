/* Y! 360° inside the desktop on chat.zalo.me. Zalo's CSP lets the page frame this extension page
   but not the Yahoo site, so this page frames the Yahoo /360 address given in its hash.
   Only /360 (or Messenger's /?return360=/360…) on the Yahoo origins (src/yahoo/net.mjs YAHOO_ORIGINS) is shown. */
const ORIGINS=['https://chat.ymvn.site'];
function blog(hash){
  try{
    const url=new URL(decodeURIComponent(hash.slice(1))),keys=[...url.searchParams.keys()];
    if(!ORIGINS.includes(url.origin))return null;
    // /?return360=/360…: Messenger checks the session, then opens that blog page itself (signed in).
    const back=url.pathname==='/'&&keys.length===1&&keys[0]==='return360'&&url.searchParams.get('return360');
    return url.pathname==='/360'||(back&&/^\/360(?:\?|$)/.test(back))?url.href:null;
  }catch{return null;}
}
// A waiting screen covers the frame until the blog itself has loaded: with /?return360=…, Messenger's
// page loads first (it checks the Y! session) and then opens the blog, which is the second load.
// Should the blog not come (signed out, a slow line), the frame shows anyway after WAIT.
const WAIT=12000;let timer=0,loads=0,needed=0;
function ready(){clearTimeout(timer);needed=0;document.body.removeAttribute('data-waiting');}
function loaded(){if(needed&&++loads>=needed)ready();}
function show(){
  const url=blog(location.hash),frame=document.querySelector('iframe');
  clearTimeout(timer);loads=0;needed=url?(new URL(url).pathname==='/'?2:1):0;
  document.body.toggleAttribute('data-waiting',!!needed);
  if(needed)timer=setTimeout(ready,WAIT);
  if(url)frame.src=url;else frame.removeAttribute('src');
  document.body.toggleAttribute('data-bad',!url);
}
document.querySelector('iframe').addEventListener('load',loaded);
addEventListener('hashchange',show);show();
