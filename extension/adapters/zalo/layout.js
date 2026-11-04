/* Geometry/hit testing only. Never reads message text. */
globalThis.YahooZaloLayout = {
  structure(root,selector){
    const n=root?.querySelector(selector);if(!n)return null;
    const shape=(p,depth)=>({tag:p.tagName,role:p.getAttribute('role'),dir:p.getAttribute('dir'),class:p.className?.baseVal??p.className,rect:[p.offsetWidth,p.offsetHeight],children:depth?[...p.children].slice(0,8).map(c=>shape(c,depth-1)):p.children.length});
    return shape(n,4);
  },
  textGeometry(root){
    const n=root.querySelector('[data-yzr-role="contact"]>div>div>div:nth-child(2)');if(!n)return null;
    const origin=n.getBoundingClientRect(),items=[];
    for(const p of [n,...n.querySelectorAll('div,span')].slice(0,48)){
      const r=p.getBoundingClientRect(),s=getComputedStyle(p),before=getComputedStyle(p,'::before'),after=getComputedStyle(p,'::after');
      items.push({tag:p.tagName,dir:p.getAttribute('dir'),rect:[r.x-origin.x,r.y-origin.y,r.width,r.height].map(Math.round),font:s.fontSize,line:s.lineHeight,display:s.display,margin:[s.marginTop,s.marginBottom],pseudo:[before.content,before.marginTop,before.marginBottom,after.content,after.marginTop,after.marginBottom]});
    }return items;
  },
  chatGeometry(root){
    const main=root.querySelector('[data-yzr-role="conversation"]'),history=main?.querySelector('[data-yzr-role="history"]');if(!history)return null;
    const origin=main.getBoundingClientRect(),items=[];
    const nodes=new Set([history,...history.querySelectorAll('div')].slice(0,24));
    for(let p=history.parentElement;p&&p!==main;p=p.parentElement)nodes.add(p);
    for(const p of nodes){const r=p.getBoundingClientRect(),s=getComputedStyle(p);items.push({tag:p.tagName,role:p.getAttribute('role'),skinRole:p.getAttribute('data-yzr-role'),rect:[r.x-origin.x,r.y-origin.y,r.width,r.height].map(Math.round),display:s.display,align:s.alignItems,justify:s.justifyContent,background:s.backgroundImage==='none'?'none':/gradient\(/.test(s.backgroundImage)?'gradient':'image',border:s.border,outline:s.outline,shadow:s.boxShadow});}
    return items;
  },
  inspect(panel) {
    const rect = n => {const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round).join(',');};
    const h=panel.querySelector('.yzr-titlebar');
    const ancestors=[];
    for(let p=panel.parentElement;p&&ancestors.length<6;p=p.parentElement){const s=getComputedStyle(p);ancestors.push([p.tagName,s.position,s.overflowX,s.overflowY,s.transform==='none'?'no-transform':'transform',s.contain,rect(p)].join('/'));}
    return {panel:rect(panel),header:h?rect(h):'missing',ancestors};
  },
  panelUsable(panel, doc = document, view = window, peers = []) {
    if (!panel?.isConnected) return false;
    if (panel.hasAttribute('data-yzr-minimized')) return true;
    const header = panel.querySelector('.yzr-titlebar');
    if (!header) return false;
    const r = header.getBoundingClientRect();
    const left = Math.max(0, r.left), right = Math.min(view.innerWidth, r.right);
    const top = Math.max(0, r.top), bottom = Math.min(view.innerHeight - 34, r.bottom);
    if (right - left < 60 || bottom - top < 12) return false;
    // A visible title must actually receive pointer hits; z-index alone is insufficient.
    return [0.25, 0.5, 0.75].some(t => {
      const hit = doc.elementFromPoint(left + (right-left)*t, (top+bottom)/2);
      // Another managed window/picker may legitimately cover this title after a drag.
      return hit === header || header.contains(hit) || peers.some(other=>other!==panel&&(other===hit||other.contains(hit))) || !!hit?.closest?.('[data-yzr-portal]');
    });
  }
};
