import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseLinks,mergeLinks,runBatch} from '../queue.js';
import {downloadBundle} from '../downloads.js';
test('bulk links deduplicate the same post across Reel and photo URLs and reject non-posts',()=>{
  const result=parseLinks('https://instagram.com/p/Test/?igsh=abc\nhttps://www.instagram.com/sample/reel/Test/\nhttps://evil.test/p/Other/');
  assert.deepEqual(result.valid,['https://www.instagram.com/p/Test/']);assert.equal(result.invalid.length,1);
  assert.throws(()=>mergeLinks([],['https://www.instagram.com/sample/']));
  assert.throws(()=>parseLinks(Array.from({length:101},(_,i)=>`https://www.instagram.com/p/Test${i}/`).join('\n')),/100/);
});
test('bulk retains partial failures, finishes current post before stopping, and stops on rate limits',async()=>{
  const events=[];let stop=false;
  const results=await runBatch(['a','b','c'],{collect:async url=>{if(url==='b')throw new Error('unavailable');return{url};},download:async post=>{if(post.url==='c')stop=true;return{state:post.url==='a'?'partial':'complete'};},onUpdate:e=>events.push(e),shouldStop:()=>stop,pause:async()=>{}});
  assert.deepEqual(results.map(r=>r.state),['partial','failed','complete']);assert.equal(events.filter(e=>e.state==='reading').length,3);
  const limited=await runBatch(['a','b'],{collect:async()=>{throw new Error('Instagram rate limited the request.');},download:async()=>assert.fail(),pause:async()=>{}});assert.equal(limited.length,1);
  let called=0;const stopped=await runBatch(['a','b'],{collect:async()=>({}),download:async()=>{called++;return{state:'complete'};},shouldStop:()=>called>0,pause:async()=>{}});assert.equal(stopped.length,1);
});
test('bulk downloads complete sidecars and ordered account-named media; failed media remain partial',async()=>{
  const captured=[],states=new Map();let id=0;
  const api={download:async options=>{if(options.url.endsWith('2.mp4'))throw new Error('blocked');const number=++id;captured.push({...options,text:options.url.startsWith('blob:')?await(await fetch(options.url)).text():null});states.set(number,{state:'complete',filename:options.filename,mime:'image/jpeg'});return number;},search:async({id})=>[states.get(id)]};
  const post={username:'example.account',shortcode:'Test',post_url:'https://www.instagram.com/p/Test/',caption:'Exact 💜\ncaption',media:[{index:1,type:'image',extension:'jpg',url:'https://cdninstagram.com/1.jpg'},{index:2,type:'video',extension:'mp4',url:'https://cdninstagram.com/2.mp4'}]};
  const result=await downloadBundle(post,()=>{},api);assert.equal(result.state,'partial');assert.equal(result.saved,1);assert.equal(result.total,2);
  assert.match(captured[1].filename,/example.account_Test_01_image.jpg$/);assert.match(captured[0].text,/Exact 💜\ncaption/);assert.equal(JSON.parse(captured.at(-1).text).downloads[1].status,'failed_or_pending');
});
test('two prompts update the queue through serialized worker writes and reject Instagram-page mutations',async()=>{
  let listener;const stored={};
  const chrome={runtime:{id:'extension',getURL:path=>'chrome-extension://extension/'+path,onMessage:{addListener:fn=>listener=fn}},action:{onClicked:{addListener(){}}},storage:{local:{get:async key=>{await new Promise(r=>setImmediate(r));return{[key]:stored[key]};},set:async value=>Object.assign(stored,value)}},tabs:{create(){}},windows:{create(){}}};
  vm.runInNewContext(fs.readFileSync(new URL('../background.js',import.meta.url),'utf8'),{chrome,URL,URLSearchParams});
  const sender={id:'extension',url:'chrome-extension://extension/prompt.html',frameId:0};
  const send=(urls,who=sender)=>new Promise(resolve=>listener({type:'SWOOP_QUEUE_CHANGE',action:'add',urls},who,resolve));
  const responses=await Promise.all([send(['https://www.instagram.com/p/One/']),send(['https://www.instagram.com/p/Two/'])]);assert.equal(responses[1].urls.length,2);assert.equal(stored['swoop.bulk.v1'].length,2);
  assert.equal((await send(['https://www.instagram.com/p/Three/'],{...sender,url:'https://www.instagram.com/'})).ok,false);
});
