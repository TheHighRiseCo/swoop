import test from 'node:test';
import assert from 'node:assert/strict';
import {zonedTime,futureTime,validateSelection,makeClient,listAccounts,uploadMedia,schedulePayload,submitJob,verifyJob,sourceURL,uploadURL,publicURL} from '../scheduler.js';
const now=Date.parse('2026-10-09T12:00:00Z');
const draft={post:{username:'example',shortcode:'Test'},caption:'Exact caption 💜\n#tag',accounts:[{id:'account-1',platform:'instagram'}],media:[{index:1,type:'image',url:'https://scontent.cdninstagram.com/photo.jpg'}],scheduledFor:'2026-10-10T16:00:00Z',timezone:'America/Los_Angeles'};
test('timezone conversion handles DST and rejects nonexistent/ambiguous dates and past publication',()=>{
  assert.equal(zonedTime('2026-10-10T09:00','America/Los_Angeles'),'2026-10-10T16:00:00.000Z');
  assert.equal(zonedTime('2026-12-10T09:00','America/Los_Angeles'),'2026-12-10T17:00:00.000Z');
  assert.throws(()=>zonedTime('2026-03-08T02:30','America/Los_Angeles'),/does not exist/);
  assert.throws(()=>zonedTime('2026-11-01T01:30','America/Los_Angeles'),/twice/);
  assert.throws(()=>zonedTime('2026-02-30T09:00','UTC'),/Invalid/);
  assert.throws(()=>futureTime('2026-10-09T11:00:00Z',now));
  assert.throws(()=>futureTime(new Date(now+119999).toISOString(),now));
});
test('platform validation never drops items or picks an account implicitly',()=>{
  assert.throws(()=>validateSelection({...draft,accounts:[]}),/destination/);
  assert.throws(()=>validateSelection({...draft,media:[]}),/media/);
  assert.throws(()=>validateSelection({...draft,media:Array(11).fill({type:'image'})}),/10 items/);
  const mixed=[{type:'image'},{type:'video'}];
  for(const platform of ['linkedin','twitter'])assert.throws(()=>validateSelection({...draft,accounts:[{id:'a',platform}],media:mixed}));
  assert.throws(()=>validateSelection({...draft,accounts:[{id:'a',platform:'twitter'}],caption:'x'.repeat(281)}));
});
test('only expected HTTPS source/storage hosts are used and credentials go only to Zernio',async()=>{
  for(const value of ['https://cdninstagram.com.evil.test/file.jpg','http://cdninstagram.com/file.jpg','https://user:pass@cdninstagram.com/file.jpg'])assert.throws(()=>sourceURL(value));
  assert.throws(()=>uploadURL('https://evil.test/upload'));assert.throws(()=>publicURL('https://evil.test/file'));
  const calls=[];const client=makeClient('test-key',async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({accounts:[{_id:'a',platform:'instagram',username:'sample',isActive:true},{_id:'b',platform:'facebook',username:'not-selected'}]}));});
  assert.equal((await listAccounts(client)).length,1);assert.equal(calls[0].url,'https://zernio.com/api/v1/accounts?status=connected&excludeHidden=true');assert.equal(calls[0].options.headers.Authorization,'Bearer test-key');assert.equal(calls[0].options.redirect,'error');
  await assert.rejects(client('//evil.test/'),/Unsupported/);
});
test('selected media is uploaded in order without leaking the API key to source or storage',async()=>{
  const calls=[];const client=async(path,{body})=>{assert.equal(path,'/media/presign');assert.equal(body.contentType,'image/jpeg');return{uploadUrl:'https://bucket.r2.cloudflarestorage.com/upload',publicUrl:'https://media.zernio.com/photo.jpg'};};
  const transport=async(url,options)=>{calls.push({url,options});return options.method==='PUT'?new Response(''):new Response(new Uint8Array([255,216,255,0,1,2]),{headers:{'content-type':'image/jpeg'}});};
  const uploaded=await uploadMedia(draft.post,draft.media,draft.accounts,{client,transport});assert.equal(uploaded.length,1);assert.equal(calls[1].options.method,'PUT');assert.equal(calls[1].options.headers.Authorization,undefined);assert.equal(calls[0].options.headers,undefined);
  await assert.rejects(uploadMedia(draft.post,draft.media,draft.accounts,{client,transport:async()=>new Response('<html>blocked</html>')}),/supported JPEG/);
});
test('schedule submission uses future time, exact targets and idempotency, then verifies provider readback',async()=>{
  const payload=schedulePayload(draft,[{type:'image',url:'https://media.zernio.com/photo.jpg'}],now),calls=[],saved=[];
  assert.equal(payload.publishNow,false);assert.deepEqual(payload.platforms,[{platform:'instagram',accountId:'account-1'}]);
  const client=async(path,options)=>{calls.push({path,options});return path==='/posts'?{post:{_id:'post-1'}}:{post:{_id:'post-1',...payload,status:'scheduled',platforms:[{platform:'instagram',accountId:{_id:'account-1'}}]}};};
  const result=await submitJob({id:'same-request',createdAt:new Date(now).toISOString(),payload},{client,save:async job=>saved.push(job),now:()=>now});assert.equal(result.status,'scheduled');assert.equal(calls[0].options.requestKey,'same-request');assert.deepEqual(saved.map(j=>j.status),['submitting','unverified','scheduled']);
  await assert.rejects(verifyJob(result,{client:async()=>({post:{...payload,status:'published'}}),save:async()=>assert.fail()}),/does not match/);
  await assert.rejects(verifyJob(result,{client:async()=>({post:{...payload,status:'scheduled',mediaItems:[]}}),save:async()=>assert.fail()}),/does not match/);
});
test('uncertain responses preserve the request for retry and never automatically resubmit',async()=>{
  const payload=schedulePayload(draft,[{type:'image',url:'https://media.zernio.com/photo.jpg'}],now),saved=[];let calls=0;
  await assert.rejects(submitJob({id:'retained-key',payload},{client:async()=>{calls++;throw new Error('network');},save:async job=>saved.push(job),now:()=>now}),/unconfirmed/);
  assert.equal(calls,1);assert.equal(saved.at(-1).status,'uncertain');assert.equal(saved.at(-1).id,'retained-key');assert.deepEqual(saved.at(-1).payload,payload);
  await assert.rejects(submitJob(saved.at(-1),{client:async()=>assert.fail(),save:async()=>assert.fail(),now:()=>Date.parse(draft.scheduledFor)}),/future/);
});
