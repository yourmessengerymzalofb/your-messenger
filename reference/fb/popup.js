let tab, enabled;
const status = document.querySelector('#status'), toggle = document.querySelector('#toggle');
async function refresh() {
  try {
    [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    const reply = await chrome.tabs.sendMessage(tab.id, {type:'yfr:status'});
    enabled = reply.enabled;
    document.querySelector('#diagnostics').textContent=reply.diagnostics?JSON.stringify(reply.diagnostics,null,2):'';
    status.textContent = ({active:reply.layout==='inline'?'Yahoo Retro · Bố cục tương thích Facebook':'Đang bật Yahoo Retro',off:'Đang dùng Facebook gốc',unrecognized:'Chưa nhận diện bố cục. Giữ Facebook gốc.','layout-error':'Bố cục bị che. Đã trở về Facebook gốc.',outside:'Hãy mở Facebook Messages.'})[reply.mode];
    if (reply.mode === 'layout-error') enabled = false;
    toggle.textContent = enabled ? 'Tắt Yahoo' : 'Bật Yahoo'; toggle.disabled = reply.mode === 'outside';
  } catch { status.textContent = 'Mở Facebook Messages hoặc tải lại tab sau khi cài extension.'; toggle.disabled = true; }
}
toggle.addEventListener('click', async () => {
  toggle.disabled = true;
  try { await chrome.tabs.sendMessage(tab.id, {type:'yfr:set',enabled:!enabled}); } catch { /* refresh reports unavailable tab */ }
  await refresh();
});
document.querySelector('#open').addEventListener('click', () => chrome.tabs.create({url:'https://www.facebook.com/messages/'}));
document.querySelector('#inspect').addEventListener('click',async()=>{try{const r=await chrome.tabs.sendMessage(tab.id,{type:'yfr:inspect'});document.querySelector('#diagnostics').textContent=JSON.stringify(r,null,2);}catch{status.textContent='Tải lại Facebook Messages trước khi chẩn đoán.';}});
refresh();
