/* A buddy-list window per chat channel (Zalo now, Facebook in P3), beside YM!.
   It reuses Yahoo's buddy-window markup and registers with the Yahoo desktop, so it moves,
   resizes, stacks and sits on the taskbar exactly like Yahoo's own windows. */
import {whenDesktop} from './desktop-bridge.mjs';

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
// Search ignores Vietnamese marks and space kinds: Zalo names are often typed without marks
// ("Tran Thi Hang" for "Trần Thị Hằng") and may hold a no-break space.
export const fold=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[đĐ]/g,'d').replace(/\s+/g,' ').toLocaleLowerCase().trim();

// name/status: the profile line and status bar (default "<label> Web"); no searchPlaceholder, no search box.
// brand: the title bar text instead of "<label> MESSENGER" (the guest window says YM!).
export function createChannelWindow(root,{id,label,icon,hint,searchPlaceholder,name=label+' Web',status:statusText='● '+label+' Web',brand:brandText=''}){
  const key=id+'-buddies';
  const node=el('aside','window buddies ym-channel-window ym-'+id+'-window');node.dataset.window=key;node.dataset.channel=id;node.setAttribute('aria-label','Danh sách '+label);
  const title=el('div','titlebar'),brand=el('span','brand',brandText||label+' ');if(!brandText)brand.append(el('small','','MESSENGER'));
  const controls=el('div','window-controls'),minimize=el('button','','−'),close=el('button','','×');
  minimize.type=close.type='button';minimize.setAttribute('aria-label','Thu gọn '+label);close.setAttribute('aria-label','Đóng '+label);
  controls.append(minimize,close);title.append(brand,controls);
  const content=el('div','ym-buddy-content');
  const profile=el('div','my-profile'),avatar=el('span','my-avatar avatar'),details=el('div','my-details');
  details.append(el('b','my-name',name),el('small','ym-channel-note',hint));profile.append(avatar,details);
  const search=el('div','contact-search'),input=el('input','');input.type='search';input.placeholder=searchPlaceholder;input.setAttribute('aria-label','Tìm trong danh sách '+label);search.append(input);
  const list=el('div','contacts ym-channel-list'),waitingNote=el('div','ym-channel-hint ym-channel-loading','Đang đọc danh sách '+label+'…'),slot=el('div','ym-channel-slot');
  list.append(waitingNote,slot);content.append(profile,...searchPlaceholder?[search]:[],list);
  const status=el('div','statusbar'),count=el('span','','');status.append(el('span','',statusText),count);
  node.append(title,content,status);

  const task=el('button','xp-task ym-channel-task');task.type='button';task.title=label;
  const taskIcon=el('img','');taskIcon.alt='';taskIcon.src=icon;task.append(taskIcon,el('span','',label));

  // Rows come from the channel adapter; keep the search, the count and the hint in step with them.
  function refresh(){
    const q=fold(input.value),rows=[...slot.querySelectorAll('.contact-row')];
    // Rows past a section's page (data-ym-paged) show only while a search finds them.
    for(const row of rows){const name=fold(row.querySelector('.contact-first b')?.textContent||row.textContent);row.hidden=q?!name.includes(q):row.hasAttribute('data-ym-paged');}
    for(const more of slot.querySelectorAll('.ym-more'))more.hidden=!!q;
    // A status line or a note from the adapter replaces the waiting hint.
    waitingNote.hidden=rows.length>0||!!slot.querySelector('.ym-channel-status,.ym-channel-hint');count.textContent=rows.length?rows.length+' hội thoại':'';
  }
  input.addEventListener('input',refresh);
  // In the combined buddy list the Yahoo search box drives this filter.
  function setQuery(q){input.value=q;refresh();}
  new MutationObserver(refresh).observe(slot,{childList:true,subtree:true});

  // Default place: right of the desktop, left of Winamp, so Yahoo chats keep their spot.
  function place(desktopIndex){
    const winamp=root.querySelector('#winamp-window'),w=282,gap=12;
    const edge=winamp&&!winamp.hidden&&winamp.getBoundingClientRect().width?winamp.getBoundingClientRect().left:innerWidth;
    const left=Math.max(8,edge-gap-(w+gap)*(desktopIndex+1)+gap);
    Object.assign(node.style,{left:left+'px',top:'52px',width:w+'px'});
  }
  let desktop=null,mounted=false;
  minimize.addEventListener('click',()=>desktop?.minimize(key));
  // Closing a channel list keeps its taskbar button, like minimizing Messenger to the tray.
  close.addEventListener('click',()=>desktop?.minimize(key));
  async function mount(desktopIndex=0){
    if(mounted)return;mounted=true;
    root.querySelector('.xp-tasks')?.append(task);
    root.append(node);place(desktopIndex);
    const d=await whenDesktop();
    if(!mounted)return;desktop=d;
    desktop.register(key,node,task,{minimum:{width:240,height:300}});
  }
  // Off the desktop again (the guest Yahoo window once the user signs in).
  function unmount(){if(!mounted)return;mounted=false;desktop?.unregister(key);desktop=null;node.remove();task.remove();}
  function setProfile(src){
    if(!src){avatar.replaceChildren();return;}
    if(avatar.firstChild?.getAttribute?.('src')===src)return;
    const img=el('img','');img.alt='';img.src=src;avatar.replaceChildren(img);
  }
  // list: the scrolling list (hint + slot); buddy-tabs.mjs moves it into Yahoo's buddy window.
  return {id,label,icon,node,task,list,slot,input,mount,unmount,setProfile,refresh,setQuery};
}
