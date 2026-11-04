/* New Zalo and Facebook messages alert like YM! ones: the "chimeup" sound (when YM! sounds are on),
   a pulsing title bar on the buddy list window and on that conversation's window, and a pulsing
   taskbar button. The signal is the unread badges in the channel lists: a count that grows, or an
   unread conversation that comes to the top of a list (a new message moves it there). */
import {YM_ASSET,localStorage} from './env.mjs';
import {fold} from './channel-window.mjs';

const TOP=3,GAP=1500,TITLE='ym-unread-title',TASK='has-new-message';
const unread=badge=>{const t=badge?.textContent.trim();return t?parseInt(t,10)||1:0;};
const soundOn=()=>{try{return JSON.parse(localStorage.getItem('ym-prefs')||'{}').sound!==false;}catch{return true;}};
const chime=()=>{try{const a=new Audio(YM_ASSET+'assets/chimeup.wav');a.volume=.45;a.play().catch(()=>{});}catch{}};

// lists: channel windows ({id,list}). taskFor(window node): its taskbar button.
// settle: ms after start before alerting, while the lists first fill in.
export function watchMessages(root,lists,{taskFor=()=>null,play=chime,settle=3000,page=globalThis.document}={}){
  const seen=new Map();let warm=false,last=0,pending=false;
  const listWindow=list=>list.closest('[data-window],#buddy-window');
  const titleOf=win=>win?.querySelector(':scope>.titlebar')||win?.querySelector('.titlebar');
  // A conversation's own window and task: title "<name> — Zalo" (or — Facebook), task label "<name>".
  const own=name=>{
    const key=fold(name),tasks=[...root.querySelectorAll('.xp-tasks .xp-task')].filter(t=>fold(t.querySelector('span')?.textContent)===key);
    const titles=[...page.querySelectorAll('.titlebar')].filter(t=>fold(t.textContent).startsWith(key+' —'));
    return {tasks,titles};
  };
  function alert(list,name){
    if(root.classList.contains('ym-away'))return;
    const win=listWindow(list.list);titleOf(win)?.classList.add(TITLE);taskFor(win)?.classList.add(TASK);
    const {tasks,titles}=own(name);tasks.forEach(t=>t.classList.add(TASK));titles.forEach(t=>t.classList.add(TITLE));
    const now=Date.now();if(now-last>GAP&&soundOn()){last=now;play();}
  }
  function read(name){const {tasks,titles}=own(name);tasks.forEach(t=>t.classList.remove(TASK));titles.forEach(t=>t.classList.remove(TITLE));}
  function scan(){
    pending=false;
    for(const list of lists){
      [...list.list.querySelectorAll('.contact-row')].forEach((row,i)=>{
        const name=(row.querySelector('.contact-first b')?.textContent||'').trim();if(!name)return;
        const key=list.id+':'+name,count=unread(row.querySelector('.contact-unread')),before=seen.get(key);seen.set(key,count);
        if(!count){if(before)read(name);return;}
        if(warm&&(before===undefined?i<TOP:count>before))alert(list,name);
      });
    }
  }
  const queue=()=>{if(!pending){pending=true;queueMicrotask(scan);}};
  const watches=lists.map(list=>{const w=new MutationObserver(queue);w.observe(list.list,{childList:true,subtree:true,characterData:true});return w;});
  // A click in a pulsing window means it has been seen.
  const seenWindow=e=>{const t=e.target.closest?.('[data-window],#buddy-window,.conversation-window');const title=titleOf(t);
    if(title?.classList.contains(TITLE)){title.classList.remove(TITLE);taskFor(t)?.classList.remove(TASK);}};
  page.addEventListener('pointerdown',seenWindow,true);
  // The first look only learns what is already unread.
  scan();if(settle)setTimeout(()=>{warm=true;},settle);else warm=true;
  return {scan,destroy(){watches.forEach(w=>w.disconnect());page.removeEventListener('pointerdown',seenWindow,true);}};
}
