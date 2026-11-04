/* Display-only, in-memory pages of native Zalo conversation metadata. */
(() => {
 const rowName=row=>(row.querySelector('[data-contact-name],.conv-item-title__name,.conv-item-title .truncate,b')?.textContent||'').trim().slice(0,100);
 const rowAvatar=row=>row.querySelector('img[src]')?.getAttribute('src')||'';
 const identity=item=>JSON.stringify([item.name,item.src]);
 // OA: an Official Account Zalo has verified (the Verified badge on the avatar, e.g. a pharmacy chain or
 // an airline). Unverified official accounts look like people and stay in Friends.
 function verified(row){
  for(const badge of row.querySelectorAll('.zavatar-container .zavatar-block .svg-icon,.zavatar-container [class*="verified" i]')){
   if(/verified/i.test(badge.className)||/Verified/i.test(getComputedStyle(badge).backgroundImage||''))return true;
  }
  return false;
 }
 function classify(row){
  const image=row.querySelector('img[src]')?.getAttribute('src')||'';let groupImage=false;
  try{groupImage=/(^|\.)ava-grp-talk(?:\.|$)/i.test(new URL(image,location.href).hostname);}catch{}
  if(row.getAttribute('data-group')==='true'||row.querySelector('.zavatar-multi,.community__conv-indicator,[data-member-count]')||groupImage)return 'Group';
  return verified(row)?'OA':'Friends';
 }
 // Yahoo Desktop host mode: groupPage shows this many groups at first, more on request;
 // icons gives rows without a picture an icon so they do not read as headers.
 globalThis.YahooZaloBuddies=({onChoose,onNotice=()=>{},groupPage=0,icons=false})=>{
  let source,view,more,status,error,handlers,observer,resizeObserver,gridStyle,cloud,cloudControl,scanOrigin,scanStats,cache=[],requested=30,groupShown=groupPage,exhausted=false,busy=false,version=0,job=Promise.resolve(),timer=0,rowHeight=78,topSignature='',initialized=false,headerGroups=new Set(),navRoot=null,slotRoot=null,filterBar=null,filterText=null,filterWatch=null;const sections=new Map();
  const gridParent=()=>source?.parentElement?.closest('.virtualized-scroll')||source?.parentElement;
  function sizeGrid(){if(!source)return;const measured=gridParent()?.clientHeight,native=source.style.height.trim(),height=measured>0?measured:/^\d+(?:\.\d+)?px$/.test(native)?parseFloat(native):0;if(height>0&&source.style.getPropertyValue('--yzr-grid-height')!==height+'px')source.style.setProperty('--yzr-grid-height',height+'px');}
  function live(epoch){return version===epoch&&source?.isConnected&&view?.isConnected;}
  function entries(){if(!source)return[];const origin=source.getBoundingClientRect();const rows=[...source.querySelectorAll('.msg-item')];const result=[];
   for(const row of rows){const name=rowName(row);if(!name)continue;const r=row.getBoundingClientRect(),indexed=row.closest('[aria-rowindex]')?.getAttribute('aria-rowindex');let index;
    if(indexed&&Number(indexed)>0)index=Number(indexed)-1;
    else if(r.height>0){rowHeight=r.height;index=Math.max(0,Math.round((r.top-origin.top+source.scrollTop-source.clientTop)/rowHeight));}
    else{const p=row.closest('[data-row-index]');index=p?Number(p.getAttribute('data-row-index')):rows.indexOf(row);}
    const src=rowAvatar(row),time=row.querySelector('time,.conv-item-title__time,.conv-item-time,[data-preview-time]');const previewTime=(time?.textContent||'').trim().slice(0,40);
    result.push({index,name,src,group:headerGroups.has(JSON.stringify([name,src]))?'Group':classify(row),unread:!!row.querySelector('.z-noti-badge,[data-unread=true]'),previewTime});
   }return result.sort((a,b)=>a.index-b.index);
  }
  // Zalo's own filters (the "Người lạ" chip that the strangers row turns on, or the "Khác" tab) swap
  // the native list under the Yahoo desktop, where their controls are covered: say so, offer the way back.
  function nativeFilter(){const bar=navRoot?.querySelector('.msg-filters-bar');if(!bar)return null;const chip=bar.querySelector('.filter-preview-v2.mc-selected,.label-filter-prev'),tabs=[...bar.querySelectorAll('.tab-item')];if(chip)return {label:chip.textContent.trim()||'bộ lọc',reset:chip.querySelector('.close')||tabs[0]};const on=tabs.find(t=>t.classList.contains('selected'));return on&&on!==tabs[0]?{label:on.textContent.trim(),reset:tabs[0]}:null;}
  function showFilter(){if(!filterBar)return;const f=nativeFilter();filterBar.hidden=!f;filterText.textContent=f?'Zalo đang lọc: '+f.label:'';}
  function gridOf(nav){const root=nav?.querySelector('#conversationList'),grids=root?.querySelectorAll('.ReactVirtualized__Grid');return root?.matches('.ReactVirtualized__Grid')?root:grids?.length===1?grids[0]:root;}
  // A filter change may render a new native grid: follow it at once instead of reading the old one.
  function filterChanged(){showFilter();if(!navRoot||!slotRoot)return;const grid=gridOf(navRoot);if(grid&&grid!==source)sync(navRoot,slotRoot);else refresh();}
  const plain=n=>n.name.normalize('NFC').replace(/\s+/g,' ').trim();
  const isCloud=n=>/^(my documents|cloud của tôi)$/i.test(plain(n));
  // Zalo's folder of messages from strangers is not a friend: list it last, with its own icon.
  const isStrangers=n=>/^tin nhắn từ người lạ$/i.test(plain(n));
  function displayed(){const pinned=cloud||cache.find(isCloud),other=cache.filter(n=>!isCloud(n)&&!isStrangers(n)),strangers=cache.filter(isStrangers);return [...[...(pinned?[{...pinned,group:'Friends'}]:[]),...other].slice(0,requested-strangers.length),...strangers.map(n=>({...n,group:'Friends'}))];}
  function describe(){if(!view||!source)return;const list=displayed(),groups=list.filter(i=>i.group==='Group').length;const text='YM! list: loaded '+list.length+'; requested '+requested+'; Group '+groups+'; Friends '+(list.length-groups)+'; scanning '+busy+'; end '+exhausted+'; max row index '+Math.max(-1,...list.map(i=>i.index))+'; native viewport '+source.clientHeight+' px; parent '+(gridParent()?.clientHeight||0)+' px; scrollTop '+Math.round(source.scrollTop)+' px; scrollHeight '+source.scrollHeight+' px.';view.setAttribute('aria-description',text);view.title=text;view.setAttribute('aria-busy',String(busy));view.dataset.yzrScan=JSON.stringify(scanStats||{});}
  function notice(text){if(error){error.textContent=text;error.hidden=!text;}if(text)onNotice(text);}
  function paint(){if(!view)return;const savedTop=view.scrollTop;for(const[group,{h,rows,detail}]of sections){const members=displayed().filter(n=>n.group===group);/* OA shows only when there is one. */if(group==='OA')detail.hidden=!members.length;const paged=group==='Group'&&groupPage>0,shown=paged?members.slice(0,groupShown):members;h.textContent=group+' ('+(paged&&shown.length<members.length?shown.length+'/':'')+members.length+')';rows.replaceChildren();for(const item of shown){const b=document.createElement('button');b.type='button';b.className='contact-row';/* Official accounts: the desktop's Chưa đọc lists them apart (buddy-tabs.mjs). */if(group==='OA')b.dataset.ymBusiness='OA';if(item.src){const pic=document.createElement('span');pic.className='tiny-avatar';const img=document.createElement('img');img.src=item.src;img.alt='';pic.append(img);b.append(pic);}else if(icons){const pic=document.createElement('span');pic.className='tiny-avatar yzr-avatar-icon';pic.dataset.yzrIcon=isCloud(item)?'cloud':isStrangers(item)?'strangers':'person';b.append(pic);}const copy=document.createElement('span');copy.className='contact-text';const first=document.createElement('span');first.className='contact-first';const name=document.createElement('b');name.textContent=item.name;const dot=presenceDot(item);if(dot){first.append(dot);/* YM!'s list paints a row's face yellow only on .online rows. */b.classList.toggle('online',!dot.classList.contains('offline'));}first.append(name);if(item.unread){const badge=document.createElement('span');badge.className='contact-unread';badge.textContent='●';badge.setAttribute('aria-label','Chưa đọc');first.append(badge);}copy.append(first);if(item.previewTime){const time=document.createElement('small');time.textContent=item.previewTime;copy.append(time);}b.append(copy);b.onclick=e=>open(item,e);rows.append(b);}
    if(paged&&(members.length>groupShown||!exhausted)){const more=document.createElement('button');more.type='button';more.className='classic-button yzr-more-groups';more.disabled=busy;more.textContent=busy?'Đang tải…':'Tải thêm nhóm';more.onclick=e=>{if(!e.isTrusted||busy)return;groupShown+=groupPage;if(members.length<groupShown&&!exhausted)return queueScan(requested+30);paint();};rows.append(more);}}
   const failed=!!error?.textContent;more.disabled=busy||(exhausted&&!failed);more.textContent=busy?'Đang tải hội thoại…':failed?'Thử tải lại':exhausted?'Đã tải hết hội thoại':'Tải thêm';status.textContent=cache.length+' hội thoại đã tải';view.scrollTop=savedTop;showFilter();describe();
  }
  function topKey(list){return JSON.stringify(list.filter(i=>i.index<3).map(i=>[i.index,i.name,i.src,i.group,i.unread,i.previewTime]));}
  async function move(top,epoch){
   if(!live(epoch))return {alive:false};sizeGrid();const grid=source,before=entries().map(i=>i.index).join(','),started=Date.now(),oldTop=grid.scrollTop;
   grid.scrollTop=Math.max(0,Math.min(Math.max(0,grid.scrollHeight-grid.clientHeight),top));
   return new Promise(resolve=>{let interval,watch,done=false;const signal=handlers.signal;
    function finish(result){if(done)return;done=true;clearTimeout(interval);watch?.disconnect();signal.removeEventListener('abort',cancel);resolve({...result,waitMs:Date.now()-started,background:!document.hasFocus(),visibility:document.visibilityState});}
    function cancel(){finish({alive:false});}
    function check(){if(!live(epoch))return cancel();const rows=entries(),key=rows.map(i=>i.index).join(','),start=Math.floor(grid.scrollTop/rowHeight),end=Math.ceil((grid.scrollTop+grid.clientHeight)/rowHeight)-1,max=Math.max(0,grid.scrollHeight-grid.clientHeight);
     // A scroll inside the existing overscan range may not change any DOM rows.
     // Otherwise wait for a NEW native range, not for a fixed 90ms timer.
     const covered=rows.length&&rows[0].index<=start&&rows.at(-1).index>=end;
     const footer=rows.length&&grid.scrollTop>=max-2&&(rows.at(-1).index+1)*rowHeight>=grid.scrollTop;
     if(rows.length&&(key!==before||covered||footer||(grid.scrollTop===oldTop&&grid.scrollTop===0)))return finish({alive:true,timedOut:false,changed:key!==before});
     if(Date.now()-started>=2000)return finish({alive:true,timedOut:true,changed:false});
     clearTimeout(interval);interval=setTimeout(check,100);
    }
    watch=new MutationObserver(check);watch.observe(grid,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});signal.addEventListener('abort',cancel,{once:true});check();
   });
  }
  async function scan(limit,epoch){if(!live(epoch))return false;busy=true;notice('');paint();const grid=source,saved=grid.scrollTop,focusedAtStart=document.hasFocus();let backgroundObserved=!focusedAtStart;scanOrigin={grid,saved,epoch};
   try{for(let attempt=0;attempt<2&&live(epoch);attempt++){const found=new Map();let end=false,position=0;
     try{for(let step=0;step<600&&live(epoch);step++){
       const rendered=await move(position,epoch);if(!rendered.alive)return false;
       const batch=entries();for(const item of batch)found.set(item.index,item);
       const values=[...found.values()].sort((a,b)=>a.index-b.index),unique=new Set(values.map(identity)),viewport=grid.clientHeight,max=Math.max(0,grid.scrollHeight-viewport);
       if(!(viewport>0))throw Error('Danh sách Zalo chưa sẵn sàng. Bấm Thử tải lại.');
       const atBottom=grid.scrollTop>=max-2,last=values.at(-1)?.index??-1;
       backgroundObserved=backgroundObserved||rendered.background;scanStats={attempt:attempt+1,steps:step+1,viewport,scrollTop:Math.round(grid.scrollTop),content:grid.scrollHeight,rendered:batch.length,range:batch.length?[batch[0].index,batch.at(-1).index]:[],captured:unique.size,observedMax:last,waitMs:rendered.waitMs,rangeChanged:!!rendered.changed,renderTimeout:!!rendered.timedOut,atBottom,focusedAtStart,backgroundObserved,visibilityAtLastRender:rendered.visibility};
       if(unique.size>=limit){end=atBottom;break;}
       if(atBottom&&(last+1)*rowHeight>=grid.scrollTop){end=true;break;}
       if(rendered.timedOut)throw Error('Zalo chưa vẽ được các hội thoại tiếp theo. Bấm Thử tải lại.');
       position=Math.min(max,grid.scrollTop+Math.max(rowHeight,viewport));
      }
      if(!live(epoch))return false;const ordered=[...found.values()].sort((a,b)=>a.index-b.index),seen=new Set(),next=[];for(const item of ordered){const key=identity(item);if(seen.has(key)){const hit=next.find(n=>identity(n)===key);if(hit)hit.ambiguous=true;continue;}seen.add(key);if(next.length<limit)next.push(item);}
      cache=next;exhausted=end&&seen.size<=limit;initialized=true;topSignature=topKey(ordered);return true;
     }catch(e){if(!live(epoch))return false;if(attempt===1)notice(e.message||'Không tải được danh sách Zalo. Bấm Thử tải lại.');}
    }return false;
   }finally{if(live(epoch)){await move(saved,epoch);if(scanOrigin?.epoch===epoch)scanOrigin=null;busy=false;paint();}}
  }
  function queueScan(limit){const epoch=version;requested=limit;job=job.catch(()=>{}).then(()=>scan(limit,epoch));return job;}
  function findLive(item){return [...source.querySelectorAll('.msg-item')].filter(n=>rowName(n)===item.name&&rowAvatar(n)===item.src);}
  async function locate(item,epoch){if(!live(epoch)||!(await move(item.index*rowHeight,epoch)).alive)return null;const matches=findLive(item),rendered=entries();return matches.length===1&&rendered.filter(i=>identity(i)===identity(item)&&i.index===item.index).length===1?matches[0]:null;}
  function open(item,event){if(event?.isTrusted!==true||event.type!=='click'||busy)return Promise.resolve(false);notice('');if(item.cloud){const ok=cloudControl&&YahooZaloActions.activate(cloudControl,event);if(ok)onChoose(item.name,'Friends');return Promise.resolve(!!ok);}if(item.ambiguous||cache.filter(n=>identity(n)===identity(item)).length!==1){notice('Không mở được: có nhiều hội thoại trùng tên và avatar. Hãy dùng tìm kiếm Zalo.');return Promise.resolve(false);}
   // Fast path for an already-rendered row; still validate its cached index.
   const matches=findLive(item),current=entries().filter(i=>identity(i)===identity(item)&&i.index===item.index);if(matches.length===1&&current.length===1){const ok=YahooZaloActions.activateRow(matches[0],event);if(ok)onChoose(item.name,item.group);return Promise.resolve(ok);}
   const epoch=version,saved=source.scrollTop;busy=true;paint();job=(async()=>{try{let target=await locate(item,epoch);if(!target&&live(epoch)){busy=false;await scan(requested,epoch);busy=true;const updated=cache.filter(n=>identity(n)===identity(item));if(updated.length===1&&!updated[0].ambiguous){item=updated[0];target=await locate(item,epoch);}}
     if(!live(epoch))return false;if(!target){notice('Không tìm thấy hội thoại duy nhất sau khi tải lại danh sách. Hãy dùng tìm kiếm Zalo.');await move(saved,epoch);return false;}const ok=YahooZaloActions.activateRow(target,event);if(ok)onChoose(item.name,item.group);return ok;
    }finally{if(live(epoch)){busy=false;paint();}}})();return job;
  }
  function openName(name,event){const hits=displayed().filter(n=>n.name===name);if(hits.length!==1){notice('Tên hội thoại trùng hoặc chưa tải. Hãy dùng tìm kiếm Zalo.');return Promise.resolve(false);}return open(hits[0],event);}
  // Zalo shows last access only in an open 1-1 conversation's header. What the header said is kept
  // here (in memory, this tab only) so the list can show it too: YM!'s yellow face while that is 10
  // minutes ago or less, counting on from when it was read; grey after. Nothing is guessed.
  // Zalo rounds down ("10 phút" is 10:00 to 10:59), hence 11 - minutes.
  const seen=new Map();let seenTimer=0;
  function setSeen(name,minutes){
   if(typeof name!=='string'||!name||minutes==null)return;const at=Date.now(),until=minutes<=10?at+(11-minutes)*60000:0,before=seen.get(name);
   seen.set(name,{until});if(!before||(before.until>at)!==(until>at))paint();
   clearInterval(seenTimer);seenTimer=setInterval(()=>{if([...seen.values()].some(v=>v.until&&v.until<=Date.now()&&!v.expired)){for(const v of seen.values())if(v.until&&v.until<=Date.now())v.expired=true;paint();}},30000);
  }
  function presenceDot(item){
   const v=item.group!=='Friends'?null:seen.get(item.name);if(!v)return null;const on=v.until>Date.now(),dot=document.createElement('span');
   dot.className='presence-dot'+(on?'':' offline');dot.title=on?'Đang truy cập (trong 10 phút)':'Truy cập hơn 10 phút trước';return dot;
  }
  function setGroup(name){const hits=cache.filter(n=>n.name===name);if(hits.length!==1)return false;const item=hits[0];headerGroups.add(identity(item));if(item.group==='Group')return false;item.group='Group';paint();return true;}
  function refresh(){if(busy||!source||!initialized)return;const list=entries();if(!list.some(i=>i.index<=2))return;const key=topKey(list);if(key===topSignature)return;clearTimeout(timer);timer=setTimeout(()=>{if(!busy)void queueScan(requested);},220);}
  function clear(){version++;clearTimeout(timer);clearInterval(seenTimer);handlers?.abort();observer?.disconnect();filterWatch?.disconnect();filterWatch=filterBar=filterText=null;resizeObserver?.disconnect();if(scanOrigin?.grid.isConnected)scanOrigin.grid.scrollTop=scanOrigin.saved;scanOrigin=scanStats=null;if(source){source.removeAttribute('data-yzr-group-source');if(gridStyle===null)source.removeAttribute('style');else if(gridStyle!==undefined)source.setAttribute('style',gridStyle);source.scrollTop=0;}view?.remove();source=view=more=status=error=null;cache=[];cloud=cloudControl=null;requested=30;groupShown=groupPage;exhausted=busy=initialized=false;topSignature='';headerGroups.clear();sections.clear();job=Promise.resolve();}
  function sync(nav,slot){navRoot=nav;slotRoot=slot;const grid=gridOf(nav);if(!grid)return clear();
   if(grid!==source||!view?.isConnected){clear();source=grid;gridStyle=grid.getAttribute('style');handlers=new AbortController();view=document.createElement('section');view.className='contacts yzr-buddy-groups';view.dataset.yzrOwned='';view.tabIndex=0;view.setAttribute('aria-label','Danh sách hội thoại YM!');
    // OA last, under Friends.
    for(const group of ['Group','Friends','OA']){const detail=document.createElement('details');detail.className='contact-group';detail.open=true;const h=document.createElement('summary'),rows=document.createElement('div');detail.append(h,rows);view.append(detail);sections.set(group,{h,rows,detail});}
    const footer=document.createElement('div');footer.className='yzr-list-footer';more=document.createElement('button');more.type='button';more.className='classic-button';more.onclick=e=>{if(e.isTrusted&&!busy&&(!exhausted||error.textContent))return queueScan(error.textContent?requested:requested+30);};status=document.createElement('small');status.setAttribute('role','status');error=document.createElement('p');error.className='yzr-list-error';error.setAttribute('role','alert');error.hidden=true;footer.append(more,status,error);view.append(footer);
    filterBar=document.createElement('div');filterBar.className='yzr-filter-bar';filterBar.hidden=true;filterBar.setAttribute('role','status');filterText=document.createElement('span');const back=document.createElement('button');back.type='button';back.className='classic-button';back.textContent='← Về danh sách chính';
    back.onclick=e=>{const f=nativeFilter();if(e?.isTrusted!==true||!f?.reset)return;if(YahooZaloActions.activate(f.reset,e))setTimeout(filterChanged,300);};
    filterBar.append(filterText,back);view.prepend(filterBar);
    const filters=nav.querySelector('.msg-filters-bar');if(filters){filterWatch=new MutationObserver(filterChanged);filterWatch.observe(filters,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});}slot.append(view);source.setAttribute('data-yzr-group-source','hidden');sizeGrid();cloudControl=YahooZaloActions.resolve(nav,'myDocuments');cloud=cloudControl?{index:-1,name:'My Documents',src:cloudControl.querySelector('img[src]')?.getAttribute('src')||'',group:'Friends',unread:false,previewTime:'',cloud:true}:null;cache=entries().slice(0,30);paint();
    observer=new MutationObserver(refresh);observer.observe(source,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','src','aria-label','title']});if(typeof ResizeObserver==='function'){resizeObserver=new ResizeObserver(sizeGrid);resizeObserver.observe(gridParent());}
    // Defer until Yahoo's slot/AutoSizer ancestors are laid out. No native click.
    const epoch=version;job=Promise.resolve().then(()=>scan(30,epoch));
   }else{sizeGrid();showFilter();refresh();describe();}
  }
  return{sync,clear,openName,setGroup,setSeen,whenIdle:()=>job};
 };
 globalThis.YahooZaloBuddy={classify,rowName,rowAvatar};
})();
