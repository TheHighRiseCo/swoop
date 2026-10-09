import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSegment,bundlePlan,waitForDownload} from '../files.js';
test('filenames are safe, ordered, and preserve UTF-8 caption',()=>{
  assert.equal(safeSegment('../../bad/path'),'_.._bad_path');
  const plan=bundlePlan({username:'sample.account',shortcode:'Test',post_url:'https://www.instagram.com/p/Test/',caption:'🌲\nFull caption',media:[{index:1,type:'image',extension:'jpg'},{index:2,type:'video',extension:'mp4'}]},new Date('2026-10-08T12:00:00Z'));
  assert.equal(plan.media[0].filename, `${plan.folder}/sample.account_Test_01_image.jpg`);
  assert.equal(plan.media[1].filename, `${plan.folder}/sample.account_Test_02_video.mp4`);
  assert.equal(plan.captionFilename, `${plan.folder}/sample.account_Test_caption.txt`);
  assert.equal(plan.metadataFilename, `${plan.folder}/sample.account_Test_metadata.json`);
  assert.match(plan.captionText,/@sample.account/); assert.match(plan.captionText,/🌲\nFull caption/);
  assert.ok(!plan.folder.split('/').includes('..'));
});
test('download confirmation waits for complete, not just an accepted request',async()=>{
  let calls=0;
  const item=await waitForDownload({search:async()=>[{state:++calls<2?'in_progress':'complete',mime:'image/jpeg',fileSize:123}]},7,{sleep:async()=>{}});
  assert.equal(calls,2);assert.equal(item.fileSize,123);
});
test('download interruption, missing records, and error pages fail',async()=>{
  for(const items of [[],[{state:'interrupted',error:'SERVER_FORBIDDEN'}],[{state:'complete',mime:'text/html'}],[{state:'complete',mime:'application/json'}]]){
    await assert.rejects(waitForDownload({search:async()=>items},8,{sleep:async()=>{}}));
  }
});
