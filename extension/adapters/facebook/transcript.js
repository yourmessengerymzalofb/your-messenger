/* Presentation metadata only. Original Facebook messages and handlers stay in place. */
(() => {
  function displayTime(label,now=new Date()){
    const clean=label.replace(/[\u202f\u00a0]/g,' '),clock=clean.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);if(!clock)return label;
    let h=+clock[1];if(clock[3])h=h%12+(/pm/i.test(clock[3])?12:0);const hhmm=String(h).padStart(2,'0')+':'+clock[2];
    let day=null;if(/today|hôm nay/i.test(clean))day=new Date(now);else if(/yesterday|hôm qua/i.test(clean)){day=new Date(now);day.setDate(day.getDate()-1);}else if(/\b\d{4}\b|\b\d{1,2}\/\d{1,2}\//.test(clean)){const parsed=new Date(clean);if(!Number.isNaN(+parsed))day=parsed;}
    else{const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],index=weekdays.findIndex(n=>clean.toLowerCase().startsWith(n.toLowerCase()));if(index>=0){day=new Date(now);day.setDate(day.getDate()-(day.getDay()-index+7)%7);}}
    return hhmm+(day?' '+String(day.getDate()).padStart(2,'0')+'-'+String(day.getMonth()+1).padStart(2,'0'):'');
  }
  globalThis.YahooRetroDisplayTime=displayTime;
  globalThis.YahooRetroTranscript=()=>{
    const originals=new Map();
    const put=(node,key,value)=>{
      let attrs=originals.get(node);if(!attrs)originals.set(node,attrs=new Map());
      if(!attrs.has(key))attrs.set(key,node.getAttribute(key));
      if(node.getAttribute(key)!==value)node.setAttribute(key,value);
    };
    const restore=node=>{for(const[key,value]of originals.get(node)||[]){if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);}originals.delete(node);};
    function sync(root,{owner='Bạn'}={}){
      const current=new Set();
      for(const article of root.querySelectorAll('[data-yfr-role="history"] [role="article"]')){
        const receipt=[...article.querySelectorAll('button[aria-label],[role="button"][aria-label]')].find(n=>/^Enter, Message sent .+ by /i.test(n.getAttribute('aria-label')||''));
        // Use the native accessibility envelope, not a guess from message content.
        const envelope=receipt?.getAttribute('aria-label')||'';
        const match=envelope.match(/^Enter, Message sent (.+?) by ([^:]+)(?::|$)/i);
        if(!match)continue; // Unrecognized/localized cards keep their native presentation.
        const sender=match[2].trim(),me=sender==='You';
        current.add(article);put(article,'data-yfr-sender',me?owner:sender);put(article,'data-yfr-time',displayTime(match[1]));put(article,'data-yfr-message',me?'outgoing':'incoming');
        // Facebook exposes a group in accessibility but its DOM often has no
        // role="group": it uses aria-roledescription="message" instead.
        const body=[...article.querySelectorAll('[aria-roledescription="message"][aria-label],[role="group"][aria-label]')].find(n=>/^At /.test(n.getAttribute('aria-label')||''));
        if(body){
          current.add(body);put(body,'data-yfr-message-body','');
          // Align row containers physically left without changing card columns.
          for(const row of body.querySelectorAll('div,span')){
            const style=getComputedStyle(row);
            if(!['flex','inline-flex'].includes(style.display)||!style.flexDirection.startsWith('row'))continue;
            current.add(row);put(row,'data-yfr-left-row',style.flexDirection==='row-reverse'?'reverse':'normal');
            for(const child of row.children)if(child.tagName==='DIV'&&!child.childNodes.length&&Number.parseFloat(getComputedStyle(child).flexGrow)>0){current.add(child);put(child,'data-yfr-row-spacer','');}
          }
          // Only flatten the OUTER path. Internal flex rows belong to Facebook
          // (calls, media, reactions, replies) and must keep their own layout.
          for(let p=body.parentElement;p&&p!==article;p=p.parentElement){current.add(p);put(p,'data-yfr-message-flow','');}
          const headings=[...body.querySelectorAll('[role="heading"],h1,h2,h3,h4,h5')];
          const plainText=match[0].endsWith(':')&&!body.querySelector('video,audio,a[href]')&&headings.every(n=>n.textContent.trim()===sender||(me&&n.textContent.trim()==='You sent'));
          const texts=plainText?[...body.querySelectorAll('div[dir="auto"]')].filter(n=>!n.closest('button,[role="button"],[role="heading"],h1,h2,h3,h4,h5')&&!n.querySelector('img,svg,video,audio,button,[role="button"],[role="heading"],h1,h2,h3,h4,h5')):[];
          put(article,'data-yfr-kind',texts.length?'text':'card');
          for(const text of texts.filter(n=>!texts.some(other=>other!==n&&other.contains(n)))){
            current.add(text);put(text,'data-yfr-message-text','');
            for(let p=text.parentElement;p&&p!==body;p=p.parentElement){current.add(p);put(p,'data-yfr-text-flow','');}
          }
        }
        for(const n of article.querySelectorAll('[aria-label^="Seen by"],[aria-label^="Đã xem"],img[alt^="Seen by"]')){current.add(n);put(n,'data-yfr-seen','');if(n.parentElement?.childElementCount===1){current.add(n.parentElement);put(n.parentElement,'data-yfr-seen','');}}
        for(const heading of article.querySelectorAll('[role="heading"],h1,h2,h3,h4,h5')){
          if(heading.textContent.trim()===sender||(me&&heading.textContent.trim()==='You sent')){current.add(heading);put(heading,'data-yfr-native-author','');}
        }
      }
      for(const node of originals.keys())if(!current.has(node))restore(node);
    }
    return{sync,clear(){for(const node of originals.keys())restore(node);}};
  };
})();
