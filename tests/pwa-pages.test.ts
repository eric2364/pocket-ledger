import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('Pages PWA keeps manifest, offline shell and worker within repository path',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ledger-pages-'));
  try{
    fs.mkdirSync(path.join(temp,'dist-web'));fs.mkdirSync(path.join(temp,'assets'));
    fs.writeFileSync(path.join(temp,'assets/icon.png'),'synthetic-icon');
    fs.writeFileSync(path.join(temp,'dist-web/index.html'),'<html><head></head><body><script src="/pocket-ledger/app.js"></script></body></html>');
    fs.writeFileSync(path.join(temp,'dist-web/app.js'),'synthetic');
    execFileSync(process.execPath,[path.resolve('scripts/prepare-pwa.mjs')],{cwd:temp,env:{...process.env,EXPO_PUBLIC_BASE_PATH:'/pocket-ledger'},stdio:'pipe'});
    const manifest=JSON.parse(fs.readFileSync(path.join(temp,'dist-web/manifest.webmanifest'),'utf8'));
    assert.equal(manifest.start_url,'/pocket-ledger/');assert.equal(manifest.scope,'/pocket-ledger/');assert.equal(manifest.icons[0].src,'/pocket-ledger/icon.png');
    const html=fs.readFileSync(path.join(temp,'dist-web/index.html'),'utf8');assert.match(html,/register\("\/pocket-ledger\/sw.js"\)/);assert.match(html,/href="\/pocket-ledger\/manifest.webmanifest"/);
    const worker=fs.readFileSync(path.join(temp,'dist-web/sw.js'),'utf8');assert.match(worker,/caches.match\('\/pocket-ledger\/index.html'\)/);assert.match(worker,/u.origin!==self.location.origin/);assert.match(worker,/u.pathname.startsWith\('\/api\/'\)/);assert.doesNotMatch(worker,/caches.match\('\/index.html'\)/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
