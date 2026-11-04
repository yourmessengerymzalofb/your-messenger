/* Hands the Yahoo desktop (client/desktop.mjs) to the port layer. A build patch calls
   ymDesktopCreated() inside client/desktop-host.mjs, so channel windows can register with the
   same window manager as Yahoo's own: z-order, dragging, resizing, taskbar. */
let desktop=null;const waiting=[];
export function ymDesktopCreated(value){desktop=value;for(const resolve of waiting.splice(0))resolve(value);}
export const whenDesktop=()=>desktop?Promise.resolve(desktop):new Promise(resolve=>waiting.push(resolve));
