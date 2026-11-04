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
