/* Web addresses in chat messages (Y!, Facebook) become links. Only http(s) addresses, shown as
   written; a click opens them in a new tab, without the page's address as referrer. */
const URL_RE=/\bhttps?:\/\/[^\s<>"'`]+|\bwww\.[^\s<>"'`]+\.[^\s<>"'`]+/gi;
// Punctuation that ends a sentence, not the address: "xem https://a.com/x." or "(https://a.com)".
const TRAIL=/[.,;:!?…]+$|\)+$/;
function trim(raw){
  let url=raw;
  for(;;){const m=url.match(TRAIL);if(!m)break;
    // Keep a closing bracket that pairs with one inside the address (Wikipedia-style links).
    if(m[0][0]===')'&&(url.match(/\(/g)||[]).length>=(url.match(/\)/g)||[]).length)break;
    url=url.slice(0,-1);}
  return url;
}
export function safeHref(text){
  try{const u=new URL(/^www\./i.test(text)?'https://'+text:text);return /^https?:$/.test(u.protocol)&&u.hostname.includes('.')?u.href:'';}catch{return '';}
}
export function link(href,text=href){
  const a=document.createElement('a');a.className='ym-chat-link';a.href=href;a.textContent=text;a.target='_blank';a.rel='noopener noreferrer';a.title=href;
  return a;
}
// Text as text nodes and links, appended to parent.
export function appendLinked(parent,text){
  text=String(text??'');URL_RE.lastIndex=0;let start=0,m;
  while((m=URL_RE.exec(text))){
    const raw=trim(m[0]),href=safeHref(raw);
    if(!href){continue;}
    if(m.index>start)parent.append(document.createTextNode(text.slice(start,m.index)));
    parent.append(link(href,raw));start=m.index+raw.length;URL_RE.lastIndex=start;
  }
  if(start<text.length)parent.append(document.createTextNode(text.slice(start)));
  return parent;
}
// Links in a message body painted by someone else (Y!'s own chat windows): text nodes only, never
// inside an existing link or button.
export function linkifyNode(body){
  const walker=document.createTreeWalker(body,4/* NodeFilter.SHOW_TEXT */),texts=[];
  for(let n=walker.nextNode();n;n=walker.nextNode())if(!n.parentElement?.closest('a,button')&&/https?:\/\/|www\./i.test(n.data))texts.push(n);
  for(const n of texts){const box=document.createDocumentFragment();appendLinked(box,n.data);n.replaceWith(box);}
}
// Every chat window on the desktop: links in new message bodies, and a click that opens them even
// when the page underneath (Zalo) handles link clicks itself.
export function watchChatLinks(root){
  const scan=node=>{if(node.nodeType!==1)return;if(node.matches('.messages .message-body'))linkifyNode(node);else for(const b of node.querySelectorAll('.messages .message-body'))linkifyNode(b);};
  const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)scan(n);});
  observer.observe(root,{childList:true,subtree:true});scan(root);
  const open=e=>{
    // defaultPrevented: env.mjs already took a Y! 360° link into its desktop window.
    const a=e.target.closest?.('a.ym-chat-link');if(e.defaultPrevented||!a||!root.contains(a)||e.button>1||!e.isTrusted)return;
    e.preventDefault();e.stopPropagation();
    const href=safeHref(a.getAttribute('href'));if(href)globalThis.open(href,'_blank','noopener,noreferrer');
  };
  root.addEventListener('click',open);root.addEventListener('auxclick',open);
  return {destroy(){observer.disconnect();root.removeEventListener('click',open);root.removeEventListener('auxclick',open);}};
}
