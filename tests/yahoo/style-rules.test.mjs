import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

// The desktop's own stylesheet (style.mjs ROOT_CSS), read as rules.
test('A folded app stays folded only in Tất cả; Zalo/Facebook loading shows a spinner and a scan bar',async()=>{
  const dom=new JSDOM('<!doctype html><body></body>');for(const k of ['window','document'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true,writable:true});
  const {ROOT_CSS}=await import('../../src/yahoo/style.mjs');
  assert.match(ROOT_CSS,/\.ym-combined\[data-tab="all"\] \.ym-source\[data-folded\]>:not\(\.ym-source-head\)\{display:none\}/);
  assert.doesNotMatch(ROOT_CSS,/#ym-root \.ym-source\[data-folded\]>:not/,'never folded inside a single-app tab');
  assert.match(ROOT_CSS,/\.ym-channel-loading::before\{[^}]*animation:ym-spin/);
  assert.match(ROOT_CSS,/\.yzr-buddy-groups\[aria-busy="true"\]::before\{[^}]*animation:ym-scan/);
  assert.match(ROOT_CSS,/prefers-reduced-motion:reduce\)\{#ym-root \.ym-channel-loading::before/);
  dom.window.close();
});

test('Chat text can be selected and copied, even when the page underneath turns selection off',async()=>{
  const {ROOT_CSS}=await import('../../src/yahoo/style.mjs');
  assert.match(ROOT_CSS,/#ym-root \.messages \.message-line \*\{-webkit-user-select:text;user-select:text\}/);
  assert.match(ROOT_CSS,/a\.ym-chat-link\{[^}]*text-decoration:underline/);
});

test('Zalo, Facebook and Telegram chat text: 13px Arial like a YM message at its default size, names at 15px',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {ROOT_CSS}=await import('../../src/yahoo/style.mjs');
  const ym=await readFile(new URL('../../vendor/yahoo-v2/client/text-style.mjs',import.meta.url),'utf8');
  assert.match(ym,/\?Number\(value\.size\):13,/,'YM default message size is 13px');
  assert.match(ROOT_CSS,/#ym-root \.ym-source-chat \.messages \.message-body\{font:13px Arial,sans-serif\}/);
  const skin=await readFile(new URL('../../extension/adapters/zalo/skin.css',import.meta.url),'utf8');
  assert.match(skin,/#messageViewContainer\{[^}]*font:15px\/1\.55 Arial/,'the sender keeps the window size');
  assert.match(skin,/#messageViewScroll \.card\{[^}]*font-size:13px;/);
  assert.match(skin,/\.text-message__container:not\(\[style\*="font-size"\]\)\{font-size:13px!important;font-family:Arial,sans-serif!important\}/);
  assert.match(skin,/\.text-message__container :not\(small\):not\(\[style\*="font-size"\]\)\{font-size:inherit!important\}/);
});
