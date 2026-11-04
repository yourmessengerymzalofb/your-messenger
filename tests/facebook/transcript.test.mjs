import {resolver as __resolver} from '../_root.mjs';const R=__resolver('facebook');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(R('extension/transcript.js'),'utf8');

test('Transcript names come from native envelope, preserve message nodes and native actions, and clean up',()=>{
 const dom=new JSDOM('<main><div data-yfr-role="history"><div role="article"><div role="group" aria-label="At 4:36 PM, You: hello"><h5>You sent</h5><div dir="auto">hello</div></div><button aria-label="Enter, Message sent 4:36 PM by You: hello"></button></div><div role="article"><div role="group" aria-label="At 4:37 PM, Alice: You sent"><h5>Alice</h5><div dir="auto">You sent</div></div><button aria-label="Enter, Message sent 4:37 PM by Alice: You sent"></button></div><div role="article">Unknown card</div></div></main>',{runScripts:'outside-only'});
 try{const w=dom.window;w.eval(source);const adapter=w.YahooRetroTranscript(),root=w.document.querySelector('main'),articles=root.querySelectorAll('[role="article"]'),body=articles[0].querySelector('[dir="auto"]'),parent=body.parentNode,nativeButton=articles[0].querySelector('button');let count=0;nativeButton.onclick=()=>count++;
 adapter.sync(root);assert.equal(articles[0].getAttribute('data-yfr-sender'),'Bạn');assert.equal(articles[1].getAttribute('data-yfr-sender'),'Alice');assert.equal(articles[1].getAttribute('data-yfr-message'),'incoming');assert.equal(articles[2].hasAttribute('data-yfr-message'),false);assert.equal(body.textContent,'hello');assert.equal(body.parentNode,parent);nativeButton.click();assert.equal(count,1);
 articles[1].remove();adapter.sync(root);assert.equal(articles[1].hasAttribute('data-yfr-sender'),false);adapter.clear();assert.equal(root.querySelector('[data-yfr-message],[data-yfr-message-body],[data-yfr-native-author]'),null);assert.equal(body.parentNode,parent);
 }finally{dom.window.close();}
});
