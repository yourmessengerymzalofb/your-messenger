'use strict';
const state=document.getElementById('state'),toggle=document.getElementById('toggle');
let tabId,enabled=true;
function paint(s){enabled=s.enabled;toggle.disabled=false;toggle.textContent=enabled?'Tắt giao diện Yahoo':'Bật giao diện Yahoo';state.textContent=s.active?'Yahoo đang bật trên Zalo Web':s.reason==='waiting'?'Chờ trang chat tương thích; màn hình gốc được giữ nguyên.':'Đang dùng giao diện Zalo gốc';}
async function refresh(){try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});tabId=tab.id;paint(await chrome.tabs.sendMessage(tabId,{type:'yzr:state'}));}catch{toggle.disabled=true;state.textContent='Mở Zalo Web rồi tải lại trang sau khi cài tiện ích.';}}
toggle.addEventListener('click',async()=>{toggle.disabled=true;try{paint(await chrome.tabs.sendMessage(tabId,{type:'yzr:set',enabled:!enabled}));}catch{state.textContent='Không kết nối được trang. Hãy tải lại Zalo Web.';}});
document.getElementById('open').addEventListener('click',()=>chrome.tabs.create({url:'https://chat.zalo.me/'}));
void refresh();
