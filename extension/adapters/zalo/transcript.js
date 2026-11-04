/* Metadata-only port of FB transcript: no history clone or cached message bodies. */
globalThis.YahooZaloTranscript=()=>{
 const marked=new Map(),senders=new Map();let typingView;
 function put(n,k,v){if(!marked.has(n))marked.set(n,new Map());if(!marked.get(n).has(k))marked.get(n).set(k,n.getAttribute(k));if(n.getAttribute(k)!==v)n.setAttribute(k,v);}
 function restore(n){for(const[k,v]of marked.get(n)||[]){if(v===null)n.removeAttribute(k);else n.setAttribute(k,v);}marked.delete(n);}
 function clear(){for(const node of senders.values())node.remove();senders.clear();typingView?.remove();typingView=null;for(const n of [...marked.keys()])restore(n);}
 function sync(root,peer,group){
  const rows=new Set(root.querySelectorAll('#messageViewScroll .chat-item')),flow=[];
  const container=root.querySelector('#messageViewContainer'),outer=root.querySelector('#messageView');
  // The real custom scrollbar has a 100%-height wrapper omitted by the old fixture.
  // Keep its absolute scrolling child untouched; only constrain the flex ancestors.
  for(let n=container?.parentElement;n&&n!==root.querySelector('#chatView');n=n.parentElement){flow.push(n);if(n===outer)break;}
  // Keep the native typing node/handlers in place. Mirror only its transient status
  // into a noninteractive overlay inside the transcript, never the message history.
  const candidates=[...root.querySelectorAll('[data-typing-indicator],[class*="typing"],[class*="Typing"]')].filter(n=>!n.closest('[data-yzr-owned],.chat-item'));
  const typing=candidates.filter(n=>!candidates.some(parent=>parent!==n&&parent.contains(n)));
  // Text bodies: older Zalo builds render .editor-input; current ones a message-text-content block.
  const inlineFlow=[],firstLines=[],textRows=new Set();for(const row of rows){let editors=row.querySelectorAll('.text-message__container .editor-input');if(!editors.length)editors=row.querySelectorAll('.text-message__container [data-component="message-text-content"]');if(editors.length!==1)continue;textRows.add(row);const editor=editors[0];for(let node=editor;node&&node!==row;node=node.parentElement)inlineFlow.push(node);const first=editor.firstElementChild;if(first?.tagName==='DIV')firstLines.push(first);}
  const weights=[...root.querySelectorAll('#messageViewScroll .chat-item [style],#chat-box-input-container-id [style]')].filter(n=>parseInt(n.style.fontWeight,10)>=500||/bold/i.test(n.style.fontWeight));
  const current=new Set([...rows,...flow,...typing,...weights,...inlineFlow,...firstLines,...(container?[container]:[])]);for(const node of [...marked.keys()])if(!current.has(node))restore(node);
  for(const n of weights)put(n,'data-yzr-semibold','');
  for(const n of inlineFlow)put(n,'data-yzr-inline-flow','');for(const n of firstLines)put(n,'data-yzr-first-text-line','');
  for(const n of flow)put(n,'data-yzr-history-flow','');
  for(const[row,node]of senders)if(!rows.has(row)||!textRows.has(row)){node.remove();senders.delete(row);}
  // Groups: Zalo names the sender on the first of their consecutive messages only.
  let previous='';
  for(const row of rows){
   const author=row.querySelector('[data-sender-name],.message-sender,.chat-item__sender-name,.message-sender-name-content');
   const own=row.classList.contains('me')||!!row.querySelector('.card.me');put(row,'data-yzr-own',String(own));
   const sender=own?'Bạn':author?.textContent.trim()||(!group?peer:previous);previous=own?'':sender;
   if(textRows.has(row)&&sender){let node=senders.get(row);if(!node?.isConnected||node.parentElement!==row){node?.remove();node=document.createElement('span');node.className='yzr-inline-sender';node.dataset.yzrOwned='';row.prepend(node);senders.set(row,node);}if(node.textContent!==sender+':')node.textContent=sender+':';}
   if(sender)put(row,'data-yzr-sender',sender+':');else row.removeAttribute('data-yzr-sender');
   put(row,'data-yzr-message','');
  }
  if(container){
   if(typingView?.parentElement!==container){typingView?.remove();typingView=document.createElement('div');typingView.className='yzr-typing-indicator';typingView.dataset.yzrOwned='';typingView.setAttribute('role','status');typingView.setAttribute('aria-live','polite');container.append(typingView);}
   const texts=[];for(const n of typing){put(n,'data-yzr-typing-source','');n.removeAttribute('data-yzr-typing-source');const style=getComputedStyle(n),visible=!n.closest('[hidden],[aria-hidden="true"]')&&style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';n.setAttribute('data-yzr-typing-source','');if(visible){const text=n.textContent.replace(/\s+/g,' ').trim();if(text&&text.length<=160)texts.push(text);}}
   const text=[...new Set(texts)].join(' · ');if(typingView.textContent!==text)typingView.textContent=text;typingView.hidden=!text;put(container,'data-yzr-has-typing',text?'true':'false');
  }
 }
 return {sync,clear};
};
