import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// As observed on chat.zalo.me: Zalo turns the pointer off for message content (.prevent-pointer-event)
// and lays a transparent hover area (.chat-message::before) over each bubble. The skin turns the
// pointer back on for message text and lets clicks pass through that area: text can be selected,
// copied and its links clicked.
test('Zalo message text can be selected and its links clicked',async()=>{
  const css=await readFile('extension/adapters/zalo/skin.css','utf8');
  assert.match(css,/#messageViewScroll \.text-message__container \*\{pointer-events:auto!important;-webkit-user-select:text!important;user-select:text!important\}/);
  assert.match(css,/#messageViewScroll \.chat-message::before\{pointer-events:none!important\}/);
});
