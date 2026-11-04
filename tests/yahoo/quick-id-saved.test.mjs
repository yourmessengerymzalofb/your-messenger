import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// A separate file: the desktop boots once per process. Fake ID and password only.
test('Saved ID, session ended: the plugin signs in again by itself, no offer',async()=>{
  const saved={nickname:'meo_hoainiem11',password:'abcdEFGH2345jkmn',created:1};
  const {dom,d,requests}=await zaloWithDesktop({stored:{ymQuickId:saved}});
  try{
    const root=d.getElementById('ym-root');
    assert.ok(root.querySelector('.ym-quick-id').hidden,'no offer when an ID is saved');
    const login=requests.filter(m=>m.path==='/api/auth/login');
    assert.equal(login.length,1);
    const body=JSON.parse(login[0].body);
    assert.equal(body.nickname,saved.nickname);assert.equal(body.password,saved.password);assert.equal(body.remember,true);
  }finally{dom.window.close();}
});
