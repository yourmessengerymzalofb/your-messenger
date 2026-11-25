import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postcss from 'postcss';

// Zalo's photo/video viewer (.zl-modal > .media-viewer) is lifted above YM! whole (windows.js).
// Its parts keep Zalo's own pointer-events and visibility: forcing them on every part made a
// see-through layer catch the clicks meant for the viewer's X.
test('Zalo photo/video viewer: shown from its own box, its X and arrows keep Zalo\'s own click layers',async()=>{
  const css=postcss.parse(await readFile(new URL('../../extension/adapters/zalo/skin.css',import.meta.url),'utf8'));
  const rules=[];css.walkRules(r=>rules.push(r));
  const forced=rules.filter(r=>r.selector.includes('[data-yzr-portal]')&&/ \*$/.test(r.selector)&&r.nodes.some(d=>d.prop==='pointer-events'&&/auto/.test(d.value)));
  assert.ok(forced.length>0,'menus and sticker panels still get their parts back');
  assert.ok(forced.every(r=>r.selector.includes(':not([data-yzr-fullscreen])')),forced.map(r=>r.selector).join('\n'));
  const viewer=rules.find(r=>r.selector==='html[data-yzr-active] [data-yzr-portal][data-yzr-fullscreen]'&&r.nodes.some(d=>d.prop==='pointer-events'));
  assert.ok(viewer,'the viewer box itself is visible and clickable');
  assert.deepEqual(viewer.nodes.map(d=>[d.prop,d.value,d.important]),[['visibility','visible',true],['pointer-events','auto',true]]);
});
