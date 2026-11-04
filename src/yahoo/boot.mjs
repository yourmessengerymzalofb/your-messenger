/* Yahoo Desktop on chat.zalo.me: mounts the YM v2 shell in #ym-root over Zalo and starts
   the vendored client. Loaded by extension/yahoo/loader.js with import(chrome.runtime.getURL(…)). */
import {YM_ROOT,ready,ymLinks} from './env.mjs';
import {origin,YAHOO_ORIGIN} from './net.mjs';
// Note: the build binds a bare `location` in every file to the Yahoo site (env.mjs); the page's own
// address is globalThis.location.
import {YT} from './youtube.mjs';
import {watchMedia} from './media.mjs';
import {injectCss,ROOT_CSS} from './style.mjs';
import {createChannelWindow} from './channel-window.mjs';
import {hostFacebook} from './facebook-channel.mjs';
import {combineBuddyLists,YAHOO_ICON} from './buddy-tabs.mjs';
import {startQuickId} from './quick-id.mjs';
import {acceptTerms} from './terms.mjs';
import {createY360Window} from './y360-window.mjs';
import {watchMessages} from './alerts.mjs';
import {startNicknameChange} from './nickname.mjs';
import baseCss from 'ym-css:globals';
import {shell} from '../../vendor/yahoo-v2/app/shell.ts';

let started=false;
export async function boot(){
  if(started||document.getElementById('ym-root'))return;started=true;
  await Promise.all([ready,origin().catch(()=>{})]);
  // Winamp looks for window.YT before loading iframe_api (blocked by Zalo's CSP).
  if(!globalThis.YT?.Player)globalThis.YT=YT;
  injectCss(ROOT_CSS,'root');injectCss(baseCss,'globals');
  YM_ROOT.className='login-screen';
  YM_ROOT.innerHTML=shell;
  const page=document.querySelector('body');
  page.append(YM_ROOT);
  // First run: the terms, before anything reads Zalo or Facebook. Declined: Zalo stays as it is.
  if(!await acceptTerms(YM_ROOT)){YM_ROOT.remove();return;}
  watchMedia(YM_ROOT);
  zaloSwitch(page,yahoo=>globalThis.YahooZaloSkin?.pause(!yahoo));
  const {startLogin}=await import('../../vendor/yahoo-v2/client/login-bootstrap.mjs');
  startLogin();
  // Y! 360° links open in a desktop window instead of chat.zalo.me/360.
  const y360=createY360Window(YM_ROOT);ymLinks.blog=url=>void y360.open(url);
  // After each sign-in, Y! 360° opens beside YM!'s buddy list, last of all: once the page has loaded,
  // the buddy list has drawn and the browser is idle. Closing it keeps it closed until the next sign-in.
  openBlogAfterSignIn(y360);
  const facebook=hostFacebook(YM_ROOT),all=[hostZalo(),facebook?.buddies].filter(Boolean);
  // Content-script world only (Zalo's own scripts cannot see it): tests and debugging.
  if(facebook)globalThis.YahooDesktopFacebook=facebook;
  // Popup choices: one Yahoo buddy list with a tab per app (default) or a window per app, and
  // which apps show at all (a hidden app keeps working underneath, it is just not listed).
  const {separate,apps}=await layout(),lists=all.filter(l=>apps[l.id]!==false);
  if(separate)lists.forEach((list,i)=>void list.mount(i+1));
  // Zalo and Facebook work without a Y! ID. Signed out, a guest YM! window holds
  // them (tabs) and, in the Yahoo list, the sign-up prompt; Yahoo's sign-in window stays hidden
  // until asked for. Signed in, the tabs move into Yahoo's own buddy list.
  const quick=startQuickId(YM_ROOT);
  // Signed in: the one-time "Đổi nick" by the profile name, while the server allows it.
  globalThis.YahooDesktopNickname=startNicknameChange(YM_ROOT);
  const guest=createChannelWindow(YM_ROOT,{id:'yahoo',label:'Y!',brand:'YM!',icon:YAHOO_ICON,name:'Chưa đăng nhập Y!',
    hint:'Zalo, Facebook dùng ngay',status:'● Khách',searchPlaceholder:separate?'':'Tìm bạn Zalo, Facebook...'});
  guest.list.querySelector('.ym-channel-hint')?.remove();
  if(quick)guest.slot.append(quick.prompt);
  const boot=YM_ROOT.querySelector('#boot');
  let mode='checking',tabs=null;
  const set=next=>{
    if(next===mode)return;mode=next;tabs?.destroy();tabs=null;
    if(next==='guest'){YM_ROOT.dataset.ymGuest='';void guest.mount(0);if(!separate)tabs=combineBuddyLists(YM_ROOT,lists,{yahoo:guest.list,search:guest.input});}
    else{delete YM_ROOT.dataset.ymGuest;delete YM_ROOT.dataset.ymAuth;guest.unmount();if(!separate)tabs=combineBuddyLists(YM_ROOT,lists,{groups:groupActions(facebook,lists)});}
    globalThis.YahooDesktopTabs=tabs;
  };
  // Guest once the session check has answered "signed out" (or after Đăng xuất); member on sign-in.
  const update=()=>{if(YM_ROOT.classList.contains('xp-signed-in'))set('member');else if(mode!=='checking'||boot?.hidden)set('guest');};
  const watch=new MutationObserver(update);
  watch.observe(YM_ROOT,{attributes:true,attributeFilter:['class']});if(boot)watch.observe(boot,{attributes:true,attributeFilter:['hidden']});
  update();
  // New Zalo and Facebook messages ring and pulse like YM! ones; the list window's taskbar button is
  // Yahoo's own buddy-list button once signed in.
  const windows=[guest,...lists];
  globalThis.YahooDesktopAlerts=watchMessages(YM_ROOT,lists,{taskFor:win=>win?.id==='buddy-window'?YM_ROOT.querySelector('#restore-workspace'):windows.find(w=>w.node===win)?.task});
}

function openBlogAfterSignIn(y360){
  let was=false,run=0;
  const idle=ms=>new Promise(r=>{const t=setTimeout(r,ms);t?.unref?.();}),quiet=()=>new Promise(r=>typeof requestIdleCallback==='function'?requestIdleCallback(()=>r(),{timeout:4000}):setTimeout(r,500));
  async function open(){
    const mine=++run,signed=()=>mine===run&&YM_ROOT.classList.contains('xp-signed-in');
    if(document.readyState!=='complete')await new Promise(r=>addEventListener('load',r,{once:true}));
    for(let i=0;i<40&&signed()&&!YM_ROOT.querySelector('#buddy-window #contacts .contact-row');i++)await idle(250);
    await idle(1500);await quiet();
    const buddies=YM_ROOT.querySelector('#buddy-window');
    if(signed()&&!buddies?.hidden)void y360.open(YAHOO_ORIGIN+'/360',{beside:buddies});
  }
  const check=()=>{const now=YM_ROOT.classList.contains('xp-signed-in');if(now&&!was)void open();if(!now)run++;was=now;};
  new MutationObserver(check).observe(YM_ROOT,{attributes:true,attributeFilter:['class']});check();
}

// "Tạo nhóm chat" on the Zalo and Facebook tabs: that app's own control, on the user's click.
function groupActions(facebook,lists){
  const shown=new Set(lists.map(l=>l.id)),groups={};
  if(shown.has('zalo'))groups.zalo=e=>{if(!globalThis.YahooZaloActions?.invoke(document.getElementById('sidebarNav'),'group',e))toast('Không tìm thấy nút Tạo nhóm của Zalo.');};
  if(facebook&&shown.has('facebook'))groups.facebook=()=>facebook.compose().then(r=>toast(r.ok?'Đã chuyển sang tab Facebook: chọn người để tạo nhóm.':'Facebook: chưa mở được Tin nhắn mới ('+(r.reason||'lỗi')+').'));
  return groups;
}
let toastTimer=0;
function toast(text){const n=YM_ROOT.querySelector('#toast');if(!n||!text)return;n.textContent=text;n.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('show'),3500);}

async function layout(){
  try{const v=await globalThis.chrome?.storage?.local?.get({ymBuddyLayout:'tabs',ymApps:{}});return {separate:v?.ymBuddyLayout==='separate',apps:v?.ymApps||{}};}
  catch{return {separate:false,apps:{}};}
}

// The Zalo skin (adapters/zalo, a classic content script in this same world) switches to host
// mode: its conversation list goes into the Yahoo buddy list, its chat windows onto our taskbar.
function hostZalo(){
  const skin=globalThis.YahooZaloSkin;if(!skin)return null;
  const zalo=createChannelWindow(YM_ROOT,{id:'zalo',label:'Zalo',icon:ZALO_ICON,hint:'Hội thoại trên Zalo Web',searchPlaceholder:'Tìm hội thoại Zalo...'});
  new MutationObserver(()=>zalo.setProfile(globalThis.YahooZaloActions?.ownAvatar?.(document.getElementById('sidebarNav'))||'')).observe(zalo.slot,{childList:true});
  // The skin sizes its windows above a taskbar of this height.
  document.documentElement.style.setProperty('--xp-bar-height',getComputedStyle(YM_ROOT).getPropertyValue('--xp-bar-height').trim()||'38px');
  skin.attach({slot:()=>zalo.slot,tasks:()=>YM_ROOT.querySelector('.xp-tasks'),notice:toast});
  return zalo;
}
const ZALO_ICON='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#0068ff"/><text x="8" y="12" font-family="Tahoma,Arial" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">Z</text></svg>');

// A tray button hands the screen back to Zalo; a round "Y!" button brings the desktop back.
function zaloSwitch(page,onSwitch){
  const back=document.createElement('button');back.className='ym-return';back.type='button';back.hidden=true;back.textContent='Y!';back.title='Mở lại YM!';
  const tray=document.createElement('button');tray.className='ym-zalo-tray';tray.type='button';tray.textContent='Zalo';tray.title='Chuyển sang Zalo';
  const show=yahoo=>{YM_ROOT.classList.toggle('ym-away',!yahoo);back.hidden=yahoo;onSwitch(yahoo);};
  tray.addEventListener('click',()=>show(false));back.addEventListener('click',()=>show(true));
  YM_ROOT.querySelector('.xp-tray')?.prepend(tray);page.append(back);
}
