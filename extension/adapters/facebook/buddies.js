/* Local grouped view of the conversations Facebook has rendered. No extra requests. */
(() => {
  const title=n=>(n.getAttribute('aria-label')||n.textContent||'').trim();
  function classify(link,knownGroup=false){
    const avatar=link.querySelector(':scope>div>div>div:first-child');
    const metadata=[link,...link.querySelectorAll('[aria-label],[title]')].map(n=>(n.getAttribute('aria-label')||'')+' '+(n.getAttribute('title')||'')).join(' ');
    const portraits=avatar?.querySelectorAll('img,svg image')||[];
    if(knownGroup||/\bgroup chat\b|\bgroup conversation\b|cuộc trò chuyện nhóm|đoạn chat nhóm/i.test(metadata)||portraits.length>1)return 'Group';
    // Facebook also says it in visually hidden text beside the avatar ("Active now"); only the avatar
    // is read, so a message preview with those words cannot count.
    const leaves=avatar?[...avatar.querySelectorAll('*')].filter(n=>!n.children.length).map(n=>n.textContent.trim()):[],hidden=leaves.join(' ');
    // A bare "7m" badge on the avatar: active 7 minutes ago (10 or less counts as online).
    if(leaves.some(t=>/^\d{1,2}\s?m$/i.test(t)&&parseInt(t,10)<=10))return 'Online';
    const labels=[...(avatar||link).querySelectorAll('[aria-label],[title]')].map(n=>(n.getAttribute('aria-label')||'')+' '+(n.getAttribute('title')||'')).join(' ')+' '+hidden;
    if(/\bActive now\b|\bOnline now\b|Đang hoạt động|Đang online/i.test(labels)||globalThis.YahooRetroRecent?.(labels))return 'Online';
    // The green dot: its exact shade changes between Facebook versions, so any clearly green colour.
    const green=c=>{const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c||'');return !!m&&+m[2]>=100&&+m[2]>1.3*m[1]&&+m[2]>1.3*m[3];};
    if(avatar)for(const node of avatar.querySelectorAll('div,span,svg circle')){
      const s=getComputedStyle(node),r=node.getBoundingClientRect();
      if(r.width>=5&&r.width<=20&&r.height>=5&&r.height<=20&&(green(s.backgroundColor)||green(s.fill)))return 'Online';
    }
    if(/Active\s+\d+.*ago|Hoạt động.*trước|Truy cập.*trước/i.test(labels))return 'Offline';
    return 'Chưa rõ trạng thái';
  }
  globalThis.YahooRetroBuddies=()=>{
    let view,source,sourceBefore,signature='',sidebarRef,abort,scrollSource,touchY;
    const knownGroups=new Set(),closed=new Set(),sections=new Map();
    function ensure(sidebar,list){
      if(source!==list){clear();source=list;sourceBefore=list.getAttribute('data-yfr-group-source');}
      sidebarRef=sidebar;
      if(view?.isConnected)return;
      view=document.createElement('section');view.className='yfr-buddy-groups';view.dataset.yfrOwned='';view.setAttribute('aria-label','Danh sách hội thoại theo nhóm');
      for(const group of ['Online','Offline','Group','Chưa rõ trạng thái']){
        const heading=document.createElement('button'),rows=document.createElement('div');rows.className='yfr-buddy-rows';heading.type='button';heading.className='yfr-buddy-heading';heading.setAttribute('aria-expanded',String(!closed.has(group)));rows.hidden=closed.has(group);
        heading.onclick=()=>{rows.hidden=!rows.hidden;closed[rows.hidden?'add':'delete'](group);heading.setAttribute('aria-expanded',String(!rows.hidden));heading.textContent=(rows.hidden?'▸':'▾')+heading.textContent.slice(1);};
        view.append(heading,rows);sections.set(group,{heading,rows});
      }
      sections.get('Chưa rõ trạng thái').heading.title='Facebook chưa cung cấp tín hiệu Active hoặc lần truy cập trong hội thoại này.';
      abort=new AbortController();const signal=abort.signal;
      const advance=delta=>{if(!scrollSource||!Number.isFinite(delta))return;scrollSource.scrollTop=Math.max(0,Math.min(scrollSource.scrollHeight-scrollSource.clientHeight,scrollSource.scrollTop+delta));};
      const edge=delta=>delta>0?view.scrollTop+view.clientHeight>=view.scrollHeight-2:view.scrollTop<=1;
      view.addEventListener('wheel',e=>{const delta=e.deltaY*(e.deltaMode===1?40:e.deltaMode===2?view.clientHeight:1);if(edge(delta)){advance(delta);e.preventDefault();}},{signal,passive:false});
      view.addEventListener('touchstart',e=>touchY=e.touches[0]?.clientY,{signal,passive:true});view.addEventListener('touchmove',e=>{const y=e.touches[0]?.clientY;if(touchY!=null&&y!=null&&edge(touchY-y)){advance(touchY-y);e.preventDefault();}touchY=y;},{signal,passive:false});
      view.tabIndex=0;view.addEventListener('keydown',e=>{if(e.target!==view)return;const delta={PageDown:view.clientHeight,PageUp:-view.clientHeight,ArrowDown:40,ArrowUp:-40,End:scrollSource?.scrollHeight,Home:-scrollSource?.scrollHeight}[e.key];if(delta&&edge(delta)){advance(delta);e.preventDefault();}},{signal});
      list.before(view);
    }
    function sync(sidebar){
      const list=sidebar.querySelector('[data-yfr-role="contact-list"]');if(!list){clear();return;}
      ensure(sidebar,list);
      scrollSource=[list,...list.querySelectorAll('div')].find(n=>n.scrollHeight>n.clientHeight+1&&/auto|scroll/.test(getComputedStyle(n).overflowY))||list;
      const groupFilter=[...sidebar.querySelectorAll('[role="tab"]')].some(n=>n.getAttribute('aria-selected')==='true'&&/^(Groups|Nhóm)$/.test(title(n)));
      const seen=new Set(),items=[];
      for(const link of list.querySelectorAll('[data-yfr-role="contact"]')){
        const key=link.getAttribute('href')?.replace(/\/$/,'');if(!key||seen.has(key))continue;seen.add(key);
        if(groupFilter)knownGroups.add(key);
        const name=link.querySelector('[data-yfr-role="contact-title"]')?.textContent.trim()||link.querySelector('[dir="auto"]')?.textContent.trim()||link.textContent.trim();
        const previewRoot=link.querySelector('[data-yfr-role="contact-preview"]');
        const visibleText=n=>{if(n.nodeType===3)return n.textContent;if(n.nodeType!==1||n.matches('[data-yfr-role="contact-a11y"],[aria-hidden="true"]'))return '';return [...n.childNodes].map(visibleText).join('');};
        const rawPreview=previewRoot?visibleText(previewRoot).trim():'';
        const unread=/Unread message:|Tin nhắn chưa đọc:/i.test(rawPreview)||/Unread message|Chưa đọc/i.test(link.getAttribute('aria-label')||'');
        const preview=rawPreview.replace(/^(?:(?:Unread message|Tin nhắn chưa đọc|You|Bạn):\s*)+/i,'');
        const avatar=link.querySelector(':scope>div>div>div:first-child img'),src=avatar?.currentSrc||avatar?.src||'';
        items.push({key,name,preview,src,link,unread,group:classify(link,knownGroups.has(key)),selected:link.getAttribute('aria-current')==='page'});
      }
      const next=JSON.stringify(items.map(({key,name,preview,src,group,selected})=>({key,name,preview,src,group,selected})));
      // Replace summaries only on change. Never reparent native React rows.
      if(next!==signature){signature=next;for(const group of ['Online','Offline','Group','Chưa rõ trạng thái']){
        const {heading,rows}=sections.get(group),members=items.filter(n=>n.group===group);heading.textContent=(closed.has(group)?'▸':'▾')+' '+group+' ('+members.length+')';rows.replaceChildren();
        for(const item of members){const button=document.createElement('button');button.type='button';button.className='yfr-buddy-entry';button.setAttribute('aria-label',item.name+' · '+group);button.dataset.selected=String(item.selected);
          const avatar=document.createElement(item.src?'img':'span');avatar.className='yfr-buddy-picture';if(item.src){avatar.src=item.src;avatar.alt='';}else avatar.textContent=group==='Group'?'👥':'🙂';
          const copy=document.createElement('span'),name=document.createElement('b'),preview=document.createElement('small');copy.className='yfr-buddy-copy';name.textContent=item.name;preview.textContent=item.preview;copy.append(name,preview);button.append(avatar,copy);
          button.dataset.unread=String(item.unread);const dot=document.createElement('span');dot.className='yfr-presence-dot';dot.dataset.state=group==='Online'?'online':'offline';dot.hidden=!['Online','Offline'].includes(group);name.prepend(dot);
          button.onclick=()=>{const current=[...source.querySelectorAll('[data-yfr-role="contact"]')].find(n=>n.getAttribute('href')?.replace(/\/$/,'')===item.key);current?.click();};rows.append(button);
        }
      }}
      source.setAttribute('data-yfr-group-source','hidden');
    }
    function clear(){abort?.abort();abort=null;view?.remove();view=null;signature='';sections.clear();if(source){if(sourceBefore===null)source.removeAttribute('data-yfr-group-source');else source.setAttribute('data-yfr-group-source',sourceBefore);}source=null;sidebarRef=null;scrollSource=null;}
    return{sync,clear};
  };
  globalThis.YahooRetroClassifyBuddy=classify;
})();
