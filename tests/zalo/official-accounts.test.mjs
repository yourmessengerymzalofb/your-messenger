import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

// Fake rows shaped like Zalo Web's conversation list (2026): a verified Official Account carries a
// Verified badge on its avatar (.zavatar-block .svg-icon with the Verified_24_Filled icon).
const row=({name,multi=false,badge='',img='https://s160-ava-talk.zadn.vn/fake.jpg'})=>`<div class="msg-item"><div class="conv-item"><div class="conv-item__avatar"><div class="zavatar-container"><div class="zavatar ${multi?'zavatar-multi':'zavatar-single'}"><img class="a-child" src="${img}"></div>${badge}</div></div><div class="conv-item-title__name"><div class="truncate">${name}</div></div></div></div>`;
const VERIFIED='<div class="zavatar-block"><div class="svg-icon svg-icon--size-xs" style="background-image:url(https://zalo-chat-static.zadn.vn/assets/Verified_24_Filled.fake.svg)"></div></div>';

test('Verified Official Accounts go to OA; groups stay Group, people and unverified accounts stay Friends',async()=>{
  const dom=new JSDOM('<body>'+row({name:'Nhà thuốc Fake',badge:VERIFIED})+row({name:'Lớp Fake',multi:true,badge:VERIFIED})+row({name:'Bạn Fake'})+row({name:'Shop Fake',badge:'<div class="zavatar-block"><div class="svg-icon" style="background-image:url(https://x.invalid/Star.svg)"></div></div>'})+'</body>',{url:'https://chat.zalo.me/',runScripts:'outside-only'});
  try{
    dom.window.eval(await readFile('extension/adapters/zalo/buddies.js','utf8'));
    const kinds=[...dom.window.document.querySelectorAll('.msg-item')].map(r=>dom.window.YahooZaloBuddy.classify(r));
    assert.deepEqual(kinds,['OA','Group','Friends','Friends']);
  }finally{dom.window.close();}
});
