import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// Signed out, Zalo moves the tab to its QR page a few seconds after load: the desktop must not flash
// up meanwhile. It comes up once Zalo shows its signed-in screen (after the QR scan).
test('The desktop waits for Zalo to be signed in',async()=>{
  const {dom,d,booting}=await zaloWithDesktop({signedIn:false});
  try{
    assert.equal(d.getElementById('ym-root'),null,'nothing of the desktop on a signed-out Zalo');
    const nav=d.createElement('nav');nav.id='sidebarNav';d.getElementById('app').append(nav);
    await booting;await tick(50);
    assert.ok(d.getElementById('ym-root')?.isConnected,'the desktop once Zalo is signed in');
  }finally{dom.window.close();}
});
