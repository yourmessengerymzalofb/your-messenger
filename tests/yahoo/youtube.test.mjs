import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

test("Winamp's YouTube frame may go full screen (the player's own button)",async()=>{
  const dom=new JSDOM('<!doctype html><body><div id="wa-video"></div></body>',{url:'https://chat.zalo.me/'});
  for(const k of ['window','document','location','addEventListener','removeEventListener'])Object.defineProperty(globalThis,k,{value:k in dom.window&&typeof dom.window[k]==='function'?dom.window[k].bind(dom.window):dom.window[k],configurable:true,writable:true});
  try{
    const {Player}=await import('../../src/yahoo/youtube.mjs');
    const player=new Player(dom.window.document.getElementById('wa-video'),{videoId:'abc123',playerVars:{controls:1}});
    const frame=dom.window.document.querySelector('iframe');
    assert.equal(player.getIframe(),frame);
    assert.ok(frame.allow.split(';').map(s=>s.trim()).includes('fullscreen'),frame.allow);
    assert.ok(frame.hasAttribute('allowfullscreen'));
    assert.match(frame.src,/^https:\/\/www\.youtube\.com\/embed\/abc123\?/);
    player.destroy();
  }finally{dom.window.close();}
});
