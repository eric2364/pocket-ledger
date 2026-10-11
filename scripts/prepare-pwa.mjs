import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve('dist-web');
const files=await fs.readdir(root);
await fs.copyFile('assets/icon.png',path.join(root,'icon.png'));
await fs.writeFile(path.join(root,'manifest.webmanifest'),JSON.stringify({name:'Pocket Ledger',short_name:'Ledger',id:'/',start_url:'/',scope:'/',display:'standalone',background_color:'#F5F4EF',theme_color:'#2D654E',icons:[{src:'/icon.png',sizes:'1024x1024',type:'image/png',purpose:'any'}]}));
const html=await fs.readFile(path.join(root,'index.html'),'utf8');
const fingerprint=crypto.createHash('sha256').update(html).digest('hex').slice(0,12);
await fs.writeFile(path.join(root,'index.html'),html.replace('</head>','<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="theme-color" content="#2D654E"></head>').replace('</body>','<script>if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").catch(()=>{});}if(navigator.storage&&navigator.storage.persist){navigator.storage.persist().catch(()=>{});}</script></body>'));
const assets=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(!['sw.js'].includes(entry.name))assets.push('/'+path.relative(root,full).split(path.sep).join('/'));}}
await walk(root);
await fs.writeFile(path.join(root,'sw.js'),`const CACHE='ledger-${fingerprint}';const ASSETS=${JSON.stringify(assets)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ledger-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.includes('signin')||u.pathname.includes('callback'))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok&&!r.redirected&&ASSETS.includes(u.pathname)){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('/index.html'):Response.error()))));});`);
console.log(`PWA prepared with ${assets.length} offline assets.`);
