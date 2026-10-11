import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

test('PWA packaging includes install assets and excludes authenticated API from its cache',()=>{
  const dir=mkdtempSync(join(tmpdir(),'wallet-pwa-'));
  try{
    mkdirSync(join(dir,'dist-web/scripts'),{recursive:true});mkdirSync(join(dir,'assets'));
    writeFileSync(join(dir,'assets/icon.png'),Buffer.from([137,80,78,71]));
    writeFileSync(join(dir,'dist-web/index.html'),'<html><head></head><body><script src="/scripts/app.js"></script></body></html>');
    writeFileSync(join(dir,'dist-web/scripts/app.js'),'console.log("fixture")');
    execFileSync(process.execPath,[resolve('scripts/prepare-pwa.mjs')],{cwd:dir});
    const html=readFileSync(join(dir,'dist-web/index.html'),'utf8');assert.match(html,/rel="manifest"/);assert.match(html,/apple-touch-icon/);assert.match(html,/serviceWorker.register/);
    const manifest=JSON.parse(readFileSync(join(dir,'dist-web/manifest.webmanifest'),'utf8'));assert.equal(manifest.display,'standalone');assert.equal(manifest.icons[0].src,'/icon.png');
    const listeners:Record<string,(event:any)=>void>={};const context=vm.createContext({self:{location:{origin:'https://wallet.example'},addEventListener:(name:string,fn:(event:any)=>void)=>{listeners[name]=fn;}},URL});
    const assets=vm.runInContext(readFileSync(join(dir,'dist-web/sw.js'),'utf8')+'\nASSETS;',context);
    for(const name of ['/index.html','/manifest.webmanifest','/icon.png','/scripts/app.js'])assert.ok(assets.includes(name));
    for(const path of ['/api/records','/api/backup','/signin-with-chatgpt','/callback']){
      let intercepted=false;listeners.fetch({request:{url:'https://wallet.example'+path,method:'GET'},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false,path);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
