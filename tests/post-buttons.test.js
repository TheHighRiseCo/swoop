import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({URL});
vm.runInContext(fs.readFileSync(new URL('../post-target.js',import.meta.url),'utf8'),context);
const {canonical,fromId}=context.SwoopTargets;
test('post IDs retain all decimal precision and map to the correct permalink',()=>{
  for (const code of ['Test','DUqvTdAjOKw','Db3euARsjBA']) {
    let id=0n; for(const c of code) id=id*64n+BigInt('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.indexOf(c));
    assert.equal(fromId(id.toString()),`https://www.instagram.com/p/${code}/`);
    assert.equal(fromId(id.toString()+'_owner'),`https://www.instagram.com/p/${code}/`);
  }
  for(const id of ['',null,'abc','0','-1','1.5'])assert.equal(fromId(id),null);
});
test('grid and Reel links resolve only to Instagram posts',()=>{
  assert.equal(canonical('/sample/reel/Test/?igsh=abc','https://www.instagram.com/'),'https://www.instagram.com/reel/Test/');
  assert.equal(canonical('/p/Test/','https://www.instagram.com/sample/'),'https://www.instagram.com/p/Test/');
  for(const link of ['/sample/','/stories/sample/','https://evil.test/p/Test/','https://instagram.com.evil.test/p/Test/','http://www.instagram.com/p/Test/','https://www.instagram.com:999/p/Test/'])assert.equal(canonical(link,'https://www.instagram.com/'),null);
});
async function background(message,sender){
  let listener; const opened=[]; let response;
  const chrome={runtime:{id:'test-extension',getURL:p=>'chrome-extension://test-extension/'+p,onMessage:{addListener:fn=>listener=fn}},action:{onClicked:{addListener(){}}},tabs:{create(){}},windows:{create:async options=>{opened.push(options);return{id:2};}}};
  vm.runInNewContext(fs.readFileSync(new URL('../background.js',import.meta.url),'utf8'),{chrome,URL,URLSearchParams});
  listener(message,sender,result=>response=result);
  await new Promise(resolve=>setImmediate(resolve));
  return{opened,response};
}
const sender={id:'test-extension',url:'https://www.instagram.com/',frameId:0,tab:{id:42}};
test('overlay prompt is bound to the clicked post and sending tab',async()=>{
  const {opened,response}=await background({type:'SWOOP_OPEN_POST',url:'https://www.instagram.com/p/Test/'},sender);
  assert.equal(response.ok,true);assert.equal(opened.length,1);assert.equal(opened[0].type,'popup');
  const u=new URL(opened[0].url);assert.equal(u.pathname,'/prompt.html');assert.equal(u.searchParams.get('tab'),'42');assert.equal(u.searchParams.get('post'),'https://www.instagram.com/p/Test/');
});
test('untrusted origins, frames, target URLs and extension identities cannot open prompts',async()=>{
  for(const [url,who] of [
    ['https://evil.test/p/Test/',sender],['https://www.instagram.com:999/p/Test/',sender],
    ['https://www.instagram.com/direct/',sender],['https://www.instagram.com/p/Test/',{...sender,frameId:1}],
    ['https://www.instagram.com/p/Test/',{...sender,id:'another-extension'}],['https://www.instagram.com/p/Test/',{...sender,url:'https://evil.test/'}]
  ]){
    const {opened,response}=await background({type:'SWOOP_OPEN_POST',url},who);
    assert.equal(opened.length,0);assert.equal(response.ok,false);
  }
});
