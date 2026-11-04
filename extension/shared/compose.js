/* Puts hub-typed text into the native editor and presses the native Send control.
   Refuses instead of guessing: an existing native draft, a mismatch after insertion
   or a missing/ambiguous Send button cancels the send and clears what was inserted. */
(() => {
  const norm=s=>(s||'').replace(/[​﻿]/g,'').replace(/\s+/g,' ').trim();
  const editorText=n=>!n?'':'value' in n&&/^(TEXTAREA|INPUT)$/.test(n.tagName)?n.value:(typeof n.innerText==='string'?n.innerText:n.textContent);
  // Source tabs usually run in the background, where Chrome slows chained timers down to one run a
  // minute: re-check on page changes (MutationObserver is not slowed) with one deadline timer.
  function wait(condition,ms=2000){
    return new Promise(resolve=>{
      let timer=0,watch=null;
      const check=()=>{try{return !!condition();}catch{return false;}};
      const finish=ok=>{clearTimeout(timer);watch?.disconnect();resolve(ok);};
      if(check()){resolve(true);return;}
      watch=new MutationObserver(()=>{if(check())finish(true);});
      watch.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true});
      timer=setTimeout(()=>finish(check()),ms);
    });
  }
  function caretToEnd(editor){
    editor.focus({preventScroll:true});
    if(/^(TEXTAREA|INPUT)$/.test(editor.tagName)){const end=editor.value.length;editor.setSelectionRange(end,end);return;}
    const selection=editor.ownerDocument.getSelection(),range=editor.ownerDocument.createRange();
    range.selectNodeContents(editor);range.collapse(false);selection.removeAllRanges();selection.addRange(range);
  }
  function clear(editor){
    if(!editor?.isConnected)return;
    const doc=editor.ownerDocument;
    editor.focus({preventScroll:true});
    if(/^(TEXTAREA|INPUT)$/.test(editor.tagName))editor.select();
    else{const selection=doc.getSelection(),range=doc.createRange();range.selectNodeContents(editor);selection.removeAllRanges();selection.addRange(range);}
    doc.execCommand('delete');
    // Facebook's editor (Lexical) ignores a delete command and keeps the text; it removes the
    // selected text on its own input event instead.
    if(norm(editorText(editor))&&editor.hasAttribute('data-lexical-editor'))
      editor.dispatchEvent(new (doc.defaultView.InputEvent)('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}));
  }
  async function send({editor,findSend,press,text,settle=1000,findWait=0,confirm=3000}){
    if(!editor?.isConnected)return {ok:false,reason:'no-editor'};
    if(norm(editorText(editor)))return {ok:false,reason:'draft-not-empty'};
    const doc=editor.ownerDocument;
    caretToEnd(editor);
    // Native editing commands go through the page editor's own input pipeline.
    text.split('\n').forEach((line,i)=>{if(i)doc.execCommand('insertLineBreak');if(line)doc.execCommand('insertText',false,line);});
    if(!await wait(()=>norm(editorText(editor))===norm(text),settle)){clear(editor);return {ok:false,reason:'editor-mismatch'};}
    // Some pages draw their Send control only once the editor has text.
    if(findWait)await wait(()=>findSend(),findWait);
    const button=findSend();
    if(!button){clear(editor);return {ok:false,reason:'no-send'};}
    if(!press(button)){clear(editor);return {ok:false,reason:'no-send'};}
    // Never resend: an unconfirmed send is reported, not retried.
    return await wait(()=>!editor.isConnected||!norm(editorText(editor)),confirm)?{ok:true,reason:''}:{ok:false,reason:'unconfirmed'};
  }
  globalThis.YahooHubCompose={send,wait,norm,editorText};
})();
