import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

export const root=new URL('../../',import.meta.url);
export const read=p=>readFile(new URL(p,root),'utf8');
export const tick=(ms=0)=>new Promise(r=>setTimeout(r,ms));

// Minimal editing commands: jsdom has no execCommand. Text goes into the editor that
// holds the selection, like the browser's native insertText would.
export function installEditing(w,log=[]){
  const target=()=>{const s=w.document.getSelection();const n=s.anchorNode;const el=n?.nodeType===1?n:n?.parentElement;return el?.closest('[contenteditable="true"],textarea')||w.document.activeElement;};
  w.document.execCommand=(cmd,ui,value)=>{
    const n=target();log.push([cmd,value]);if(!n)return false;
    const isField=/^(TEXTAREA|INPUT)$/.test(n.tagName);
    if(cmd==='insertText'){if(isField)n.value+=value;else n.append(value);}
    else if(cmd==='insertLineBreak'){if(isField)n.value+='\n';else n.append('\n');}
    else if(cmd==='delete'){if(isField)n.value='';else n.textContent='';}
    else return false;
    n.dispatchEvent(new w.InputEvent('input',{bubbles:true,inputType:cmd}));return true;
  };
  return log;
}

// A pair of fake runtime ports, enough for the router, bridge and hub view.
export function portPair(name,sender){
  const make=()=>{const l={msg:[],dis:[]};return {l,onMessage:{addListener:f=>l.msg.push(f)},onDisconnect:{addListener:f=>l.dis.push(f)}};};
  const a=make(),b=make();let open=true;
  const close=()=>{if(!open)return;open=false;for(const f of a.l.dis)f();for(const f of b.l.dis)f();};
  const clone=m=>JSON.parse(JSON.stringify(m));
  const client={name,...a,sent:[],postMessage(m){if(!open)throw new Error('closed');client.sent.push(clone(m));for(const f of b.l.msg)f(clone(m));},disconnect:close};
  const server={name,sender,...b,sent:[],postMessage(m){if(!open)throw new Error('closed');server.sent.push(clone(m));for(const f of a.l.msg)f(clone(m));},disconnect:close};
  return {client,server,get open(){return open;}};
}
