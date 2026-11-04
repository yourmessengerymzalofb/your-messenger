/* Forward only explicit Yahoo button clicks to the current native Facebook control.
   No private APIs, session access or automatic sends/calls. */
(() => {
  // "Active 7m ago" / "Hoạt động 7 phút trước": 10 minutes or less counts as online (the user's
  // rule); hours and days never do. buddies.js uses it for the list too.
  const RECENT=/Active\s+(\d{1,2})\s*(?:m|mins?|minutes?)\s+ago\b|Hoạt động\s+(\d{1,2})\s+phút\s+trước/i;
  const recent=text=>{const m=RECENT.exec(text||'');return !!m&&+(m[1]||m[2])<=10;};
  globalThis.YahooRetroRecent=recent;
  const labels = {
    video:['Start a video call','Bắt đầu cuộc gọi video','Gọi video'],
    voice:['Start a voice call','Bắt đầu cuộc gọi thoại','Gọi thoại'],
    attach:['Attach a file up to 100 MB','Đính kèm tệp có dung lượng tối đa 100 MB','Đính kèm tệp','Attach a file'],
    sticker:['Choose a sticker','Chọn nhãn dán'],
    emoji:['Choose an emoji','Chọn biểu tượng cảm xúc'],
    gif:['Choose a GIF','Chọn file GIF','Chọn GIF'],
    voiceClip:['Send a voice clip','Gửi đoạn ghi âm','Gửi tin nhắn thoại'],
    info:['Conversation information','Thông tin cuộc trò chuyện'],
    send:['Send','Gửi','Press Enter to send','Nhấn Enter để gửi'],
    like:['Send a like','Gửi lượt thích'],
    search:['Search Messenger','Tìm kiếm trên Messenger','Tìm kiếm Messenger'],
    newMessage:['New message','Tin nhắn mới'],
    settings:['Settings, help and more','Cài đặt, trợ giúp và hơn thế nữa']
  };
  const name=n=>(n.getAttribute('aria-label')||n.getAttribute('title')||n.textContent||'').trim();
  const owned=n=>!!n.closest('[data-yfr-owned]');
  const normalize=s=>(s||'').normalize('NFC').trim().toLocaleLowerCase();
  function resolve(root,key) {
    const expected=labels[key]?.map(normalize)||[];
    const nodes=[...root.querySelectorAll('button,[role="button"],a,input[aria-label],[role="combobox"]')].filter(n=>!owned(n)&&expected.includes(normalize(name(n))));
    const matches=nodes.filter(n=>n.isConnected&&!n.disabled&&n.getAttribute('aria-disabled')!=='true'&&!n.closest('[hidden],[aria-hidden="true"]'));
    return matches.length===1?matches[0]:null;
  }
  function invoke(root,key) {
    const target=resolve(root,key);if(!target)return false;
    if(key==='search')target.focus({preventScroll:true});else target.click();
    return true;
  }
  function access(root){
    const header=root.querySelector('[data-yfr-role="native-header"]')||[...root.querySelectorAll('a')].find(n=>!n.closest('[data-yfr-owned],[role="log"]')&&n.querySelector('h1,h2,h3,h4,[role="heading"]'));
    const labels=header?[...header.querySelectorAll('[aria-label]')].map(n=>n.getAttribute('aria-label')).join(' '):'';
    const text=((header?.textContent||'')+' '+labels).trim();
    const online=text.match(/Active now|Đang hoạt động|Đang online/i),offline=text.match(/Active\s+\d+\s*(?:m|h|d|minutes?|hours?|days?)\s*ago|Hoạt động[^·]*trước|Truy cập[^·]*trước/i);
    return online?{state:'online',text:online[0]}:offline?{state:'offline',text:offline[0]}:{state:'unknown',text:''};
  }
  function avatar(root){const images=[...root.querySelectorAll('img')].filter(n=>!n.closest('[data-yfr-owned]'));return images.length===1?(images[0].currentSrc||images[0].src):'';}
  function owner(){const account=document.querySelector('[aria-label^="Account,"],[aria-label^="Tài khoản,"]');return {name:account?.getAttribute('aria-label')?.replace(/^(?:Account,|Tài khoản,)\s*/,'').replace(/^(your profile|trang cá nhân của bạn)$/i,'')||'—',src:account?avatar(account):''};}
  function presence(root) {
    // Read only header/profile state, never infer presence from message history.
    const region=[...root.querySelectorAll('[aria-label]')].find(n=>/^(Conversation with |Cuộc trò chuyện với )/.test(n.getAttribute('aria-label')||''));
    const link=[...(region||root).querySelectorAll('a[href]')].find(n=>!n.closest('[role="log"],[role="article"],[data-yfr-owned]')&&n.querySelector('h1,h2,h3,h4,[role="heading"]'));
    const text=(link?.textContent||'')+' '+(link?.getAttribute('aria-label')||'')+' '+(link?.querySelector('[aria-label="Active now"],[aria-label="Đang hoạt động"]')?.getAttribute('aria-label')||'');
    // Active within the last 10 minutes counts as available ("Active 7m ago").
    return /Active now|Đang hoạt động|Đang online/i.test(text)||recent(text)?'Available':(/Active \d|Hoạt động .* trước/i.test(text)?'Offline':'');
  }
  function peerName(root){
    const native=n=>!n.closest('[data-yfr-owned],[role="log"],[role="article"]');
    const region=[...root.querySelectorAll('[aria-label]')].find(n=>native(n)&&/^(Conversation with |Cuộc trò chuyện với )/.test(n.getAttribute('aria-label')||''));
    const input=root.querySelector('[contenteditable="true"][role="textbox"],textarea');
    const fromInput=(input?.getAttribute('aria-label')||'').match(/^(?:Write to |Viết cho |Nhắn tin cho |Gửi tin nhắn cho )(.+)$/i)?.[1];
    const heading=[...root.querySelectorAll('h1,h2,h3,h4,[role="heading"]')].find(n=>native(n)&&!/^Messages$|^Compose$|^Tin nhắn$/i.test(n.textContent.trim()));
    return (fromInput||region?.getAttribute('aria-label')?.replace(/^(Conversation with |Cuộc trò chuyện với )/,'')||heading?.textContent?.replace(/^(Conversation with |Cuộc trò chuyện với )/,'').trim()||'Conversation').slice(0,100);
  }
  globalThis.YahooRetroActions={resolve,invoke,presence,access,avatar,owner,peerName,labels};
})();
