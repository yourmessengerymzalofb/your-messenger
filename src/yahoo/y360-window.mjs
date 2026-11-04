/* Y! 360° in a YM! window, like YM 9's Insider: YM!'s purple title bar, the blog in a
   white panel, a link bar at the bottom. No browser chrome. The blog is its own site behind the Yahoo
   address /360, so the panel frames it, through the extension page yahoo/y360.html (Zalo's CSP frames
   only that). It registers with the Yahoo desktop: taskbar, drag, resize, maximize. */
import {whenDesktop} from './desktop-bridge.mjs';
import {YM_ASSET} from './env.mjs';
import {YAHOO_ORIGIN} from './net.mjs';
import {YAHOO_ICON} from './buddy-tabs.mjs';

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
const KEY='y360';

// frame: the wrapper page's URL; the blog address goes in its hash.
// signedIn: whether the desktop is signed in to Y! (then the blog opens signed in too).
export function createY360Window(root,{frame=globalThis.chrome?.runtime?.getURL?.('yahoo/y360.html')||'y360.html',signedIn=()=>root.classList.contains('xp-signed-in')}={}){
  const icon=YM_ASSET+'icons/blog360.svg';
  const node=el('aside','window ym-y360-window');node.dataset.window=KEY;node.setAttribute('aria-label','Y! 360°');
  const title=el('div','titlebar'),brand=el('span','brand','Y!');brand.append(el('small','','360°'));
  const controls=el('div','window-controls'),buttons={};
  for(const[key,text,label]of[['min','−','Thu Y! 360°'],['max','□','Phóng to Y! 360°'],['close','×','Đóng Y! 360°']]){const b=el('button','',text);b.type='button';b.setAttribute('aria-label',label);controls.append(b);buttons[key]=b;}
  title.append(brand,controls);
  const body=el('div','ym-y360-body'),panel=el('div','ym-y360-panel'),view=el('iframe','ym-y360-frame');view.title='Y! 360°';panel.append(view);
  // The link bar: YM!'s Y! badge, then the blog's home, a reload, and the blog in a tab of its own.
  const links=el('div','ym-y360-links'),badge=el('img','ym-y360-badge');badge.alt='Y!';badge.src=YAHOO_ICON;
  const link=(text,titleText)=>{const b=el('button','ym-y360-link',text);b.type='button';b.title=titleText;return b;};
  const home=link('Trang chủ Y!360','Về trang chủ Y! 360°'),reload=link('Làm mới','Tải lại trang Y! 360° đang xem');
  const external=el('a','ym-y360-link ym-y360-external','Mở trong tab mới');external.target='_blank';external.rel='noopener';external.title='Mở Y! 360° trong tab mới';
  links.append(badge,home,el('span','ym-y360-dot','·'),reload,el('span','ym-y360-dot','·'),external);
  body.append(panel,links);node.append(title,body);
  const task=el('button','xp-task ym-y360-task');task.type='button';task.title='Y! 360°';
  const taskIcon=el('img');taskIcon.alt='';taskIcon.src=icon;task.append(taskIcon,el('span','','Y! 360°'));

  let desktop=null,registered=null,last='';
  // Zalo removes iframes whose src is a chrome-extension:// URL, so the frame keeps no src and is
  // navigated there instead (Chrome lets a parent navigate its child frame).
  const go=url=>{try{view.contentWindow?.location.replace(url);}catch{}};
  // data-ym-url: the blog address shown (tests, debugging).
  // Chrome gives the frame's first page no Y! session (the extension page asks for it), but it does give
  // the session to what the Yahoo site in the frame asks for itself (yahoo-proxy.js). So a signed-in
  // desktop opens Messenger's /?return360=…: it checks the session and then opens the blog page itself.
  const target=url=>{if(!signedIn())return url;const u=new URL(url);return u.origin+'/?return360='+encodeURIComponent(u.pathname+u.search);};
  const load=()=>{view.dataset.ymUrl=last;go(frame+'#'+encodeURIComponent(target(last)));};
  const unload=()=>{delete view.dataset.ymUrl;go('about:blank');};
  function register(){
    // Closing unloads the blog; the taskbar button brings back the last address.
    registered??=whenDesktop().then(d=>{
      desktop=d;root.querySelector('.xp-tasks')?.append(task);root.append(node);
      d.register(KEY,node,task,{closed:true,minimum:{width:420,height:360},onClose:unload,onRestore:()=>{if(last&&!view.dataset.ymUrl)load();}});
      buttons.min.addEventListener('click',()=>d.minimize(KEY));
      buttons.max.addEventListener('click',()=>d.maximize(KEY));
      buttons.close.addEventListener('click',()=>d.close(KEY));
      home.addEventListener('click',()=>void open(YAHOO_ORIGIN+'/360'));
      reload.addEventListener('click',()=>{if(last)load();});
    });
    return registered;
  }
  // beside: a window node (YM!'s buddy list) to sit next to, right of it when there is room, same top
  // and height, without taking the focus from it.
  function dock(beside){
    const r=beside?.getBoundingClientRect?.();if(!r||!r.width)return;
    const width=Math.min(820,Math.max(420,innerWidth-r.right-24)),left=r.right+8+width<=innerWidth?r.right+8:Math.max(8,r.left-8-width);
    Object.assign(node.style,{left:left+'px',top:Math.max(8,r.top)+'px',width:width+'px',height:Math.max(360,r.height)+'px'});
  }
  // url: a Yahoo /360 address (absolute).
  async function open(url,{beside=null}={}){
    await register();if(beside)dock(beside);
    // No address bar: the address is the panel's tooltip.
    last=url;panel.title=url;external.href=url;load();
    desktop.restore(KEY);
    // Opened beside YM!: YM! stays the window in front.
    if(beside){const id=beside.dataset?.window;if(id)desktop.restore(id,false);}
  }
  return {node,task,frame:view,open};
}
