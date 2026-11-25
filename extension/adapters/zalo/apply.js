/* Popup "Lưu" (popup.js) saves its choices together with ymApplyAt. This Zalo tab then reloads so
   they take effect, instead of asking for F5. Nothing else is read or sent. */
(()=>{
  try{chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.ymApplyAt)location.reload();});}catch{}
})();
