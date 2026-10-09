import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {collectPost} from '../collector.js';
const url = 'https://scontent.cdninstagram.com/media/photo.jpg?signature=test';
const image = {pk:'1',media_type:1,image_versions2:{candidates:[{url,width:1080,height:1350},{url:url.replace('photo','small'),width:320,height:400}]}};
const video = {pk:'2',media_type:2,video_versions:[{url:'https://video.cdninstagram.com/media/movie.mp4',width:1080,height:1920}]};
const post = (extra={}) => ({...image,pk:'123',code:'Test',user:{username:'sample.account'},caption:{text:'First line\nSecond line 🌲 #tag'},...extra});
async function run(records, fetch = () => {throw new Error('Unexpected network fallback');}, path='/p/Test/', target) {
  const context = vm.createContext({location:{hostname:'www.instagram.com',pathname:path},
    document:{querySelectorAll:()=>records.map(record=>({textContent:JSON.stringify(record)}))},URL,AbortSignal,fetch});
  context.target = target;
  return await vm.runInContext(`(${collectPost.toString()})(target)`, context);
}
test('exact target only, full caption and largest image', async()=>{
  const result=await run([{data:[post({code:'Neighbor'}),post()]}]);
  assert.equal(result.ok,true); assert.equal(result.post.caption,'First line\nSecond line 🌲 #tag');
  assert.equal(result.post.media[0].width,1080); assert.equal(result.post.media[0].url,url);
});
test('mixed carousel preserves order and downloads video instead of its thumbnail', async()=>{
  const result=await run([post({media_type:8,carousel_media_count:3,carousel_media:[image,video,image]})]);
  assert.equal(result.ok,true); assert.equal(result.post.media_count,3);
  assert.deepEqual(Array.from(result.post.media,x=>x.type),['image','video','image']);
  assert.match(result.post.media[1].url,/movie\.mp4$/);
});
test('single video without a caption',async()=>{
  const result=await run([post({...video,caption:null})],undefined,'/reel/Test/');
  assert.equal(result.ok,true); assert.equal(result.post.caption,''); assert.equal(result.post.media[0].type,'video');
});
test('account-prefixed post and Reel URLs work',async()=>{
  for (const path of ['/sample.account/p/Test/','/sample.account/reel/Test/']) {
    assert.equal((await run([post()],undefined,path)).ok,true);
  }
});
test('legacy GraphQL carousel schema',async()=>{
  const result=await run([{shortcode:'Test',__typename:'GraphSidecar',owner:{username:'sample'},
    edge_media_to_caption:{edges:[{node:{text:'Full caption'}}]},edge_sidecar_to_children:{edges:[{node:{id:'1',is_video:false,display_url:url}},{node:{id:'2',is_video:true,video_url:video.video_versions[0].url}}]}}]);
  assert.equal(result.ok,true); assert.equal(result.post.media_count,2);
});
test('missing video URL is not replaced by an image',async()=>{
  const record=post({media_type:2,video_versions:[]});
  const result=await run([record],async()=>({ok:true,json:async()=>({items:[record]})}));
  assert.equal(result.ok,false); assert.match(result.error,/not be replaced with a thumbnail/);
});
test('incomplete carousel is rejected',async()=>{
  const record=post({media_type:8,carousel_media_count:4,carousel_media:[image,video]});
  const result=await run([record],async()=>({ok:true,json:async()=>({items:[record]})}));
  assert.equal(result.ok,false); assert.match(result.error,/2 of 4/);
});
test('no guessed username or caption, and lookalike CDN hosts rejected',async()=>{
  for(const record of [post({user:null}),post({caption:undefined}),post({image_versions2:{candidates:[{url:'https://cdninstagram.com.evil.test/file.jpg'}]}})]){
    const result=await run([record],async()=>({ok:true,json:async()=>({items:[record]})})); assert.equal(result.ok,false);
  }
});
test('fallback endpoint uses a lossless decimal shortcode ID',async()=>{
  let endpoint;
  const result=await run([],async path=>{endpoint=path;return{ok:true,json:async()=>({items:[post()]})};});
  assert.equal(result.ok,true);
  let expected=0n;for(const c of 'Test')expected=expected*64n+BigInt('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.indexOf(c));
  assert.equal(endpoint,`/api/v1/media/${expected}/info/`);
});
test('rate limits, login blocks, malformed responses and invalid pages are explicit',async()=>{
  for(const status of [429,401,403,500]){
    const result=await run([],async()=>({ok:false,status})); assert.equal(result.ok,false); assert.ok(result.error);
  }
  assert.equal((await run([],undefined,'/sample.account/')).ok,false);
  assert.equal((await run([],async()=>({ok:true,json:async()=>{throw new Error('Invalid JSON');}}))).ok,false);
});
test('feed click extracts the selected post, not its neighbor or the page URL',async()=>{
  const result=await run([{posts:[post({code:'Other'}),post()]}],undefined,'/','https://www.instagram.com/p/Test/');
  assert.equal(result.ok,true); assert.equal(result.post.shortcode,'Test');
  assert.equal(result.post.caption,'First line\nSecond line 🌲 #tag');
});
test('feed fallback requests the selected post and preserves mixed carousel order',async()=>{
  let endpoint;
  const result=await run([],async path=>{endpoint=path;return {ok:true,json:async()=>({items:[post({media_type:8,carousel_media_count:2,carousel_media:[image,video]})]})};},'/','https://www.instagram.com/reel/Test/');
  assert.equal(result.ok,true); assert.match(endpoint,/^\/api\/v1\/media\/\d+\/info\/$/);
  assert.deepEqual(Array.from(result.post.media,x=>x.type),['image','video']);
});
test('explicit non-Instagram or non-post targets are rejected without requests',async()=>{
  for(const target of ['https://instagram.com.evil.test/p/Test/','https://evil.test/p/Test/','http://www.instagram.com/p/Test/','https://www.instagram.com/direct/','https://user:pass@www.instagram.com/p/Test/','https://www.instagram.com:999/p/Test/']) {
    assert.equal((await run([],undefined,'/',target)).ok,false);
  }
});
