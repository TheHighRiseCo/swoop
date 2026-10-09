import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {makePostizClient,listPostizAccounts,postizPayload,uploadPostizMedia,postizMediaPath,submitPostizJob,verifyPostizJob} from '../postiz.js';
import {validateLocal,calendarText,createLocalKit} from '../local-schedule.js';
const now=Date.parse('2026-10-09T12:00:00Z'),when='2026-10-10T16:00:00.000Z';
const draft={post:{username:'sample.account',shortcode:'Test',post_url:'https://www.instagram.com/p/Test/'},caption:'Edited 💜\ncaption',media:[{index:2,type:'image',extension:'jpg',url:'https://scontent.cdninstagram.com/2.jpg'}],accounts:[{id:'ig',platform:'instagram',provider:'instagram-standalone'},{id:'li',platform:'linkedin',provider:'linkedin-page'}],scheduledFor:when,timezone:'America/Los_Angeles',localTargets:['instagram','linkedin']};
const upload=[{id:'media-1',path:'https://uploads.postiz.com/2.jpg'}];
test('Postiz connection uses only selected API origin, raw key and explicit active channels',async()=>{
  const calls=[];const client=makePostizClient('test-key','cloud',async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify([{id:'ig',identifier:'instagram-standalone',profile:'sample',disabled:false},{id:'disabled',identifier:'x',disabled:true},{id:'other',identifier:'facebook',disabled:false}]));});
  const rows=await listPostizAccounts(client);assert.equal(rows.length,1);assert.equal(rows[0].platform,'instagram');assert.equal(calls[0].url,'https://api.postiz.com/public/v1/integrations');assert.equal(calls[0].options.headers.Authorization,'test-key');assert.equal(calls[0].options.redirect,'error');await assert.rejects(client('/../posts'),/Unsupported/);
  await makePostizClient('local-key','local',async(url,options)=>{assert.equal(url,'http://127.0.0.1:4007/api/public/v1/integrations');assert.equal(options.headers.Authorization,'local-key');return new Response('[]');})('/integrations');
  assert.throws(()=>makePostizClient('key','unknown'));assert.throws(()=>postizMediaPath('http://evil.test/media','cloud'));assert.throws(()=>postizMediaPath('https://uploads.postiz.com.evil.test/media','cloud'));assert.equal(postizMediaPath('http://127.0.0.1:4007/uploads/a.jpg','local'),'http://127.0.0.1:4007/uploads/a.jpg');assert.throws(()=>postizMediaPath('http://127.0.0.1:8080/a.jpg','local'));
});
test('Postiz uploads selected bytes with multipart form and preserves the media ID/order',async()=>{
  const calls=[];const uploaded=await uploadPostizMedia(draft.post,draft.media,{transport:async(url,options)=>{assert.equal(options.headers,undefined);return new Response(new Uint8Array([255,216,255,1,2]));},client:async(path,options)=>{calls.push({path,options});return upload[0];}});
  assert.deepEqual(uploaded,upload);assert.equal(calls[0].path,'/upload');assert.equal(calls[0].options.body.get('file').name,'sample.account_Test_02.jpg');assert.equal(calls[0].options.body.get('file').type,'image/jpeg');
  await assert.rejects(uploadPostizMedia(draft.post,draft.media,{transport:async()=>new Response('<html>error</html>'),client:async()=>assert.fail()}),/supported/);
});
test('Postiz future-only payload verifies every returned destination through independent readback',async()=>{
  const payload=postizPayload(draft,upload,now);assert.equal(payload.type,'schedule');assert.deepEqual(payload.posts.map(p=>p.settings.__type),['instagram-standalone','linkedin-page']);assert.equal(payload.posts[0].settings.post_type,'post');assert.equal(payload.posts[0].value[0].content,draft.caption);assert.deepEqual(payload.posts[0].value[0].image,upload);
  const refs=[{postId:'p-ig',integration:'ig'},{postId:'p-li',integration:'li'}],saved=[];
  const readback={posts:refs.map(r=>({id:r.postId,content:draft.caption,publishDate:when,state:'QUEUE',integration:{id:r.integration,providerIdentifier:payload.posts.find(p=>p.integration.id===r.integration).settings.__type}}))};
  const calls=[],client=async(path,options)=>{calls.push(path);return options?.method==='POST'?refs:readback;};const job=await submitPostizJob({id:'request',provider:'postiz',payload},{client,save:async row=>saved.push(row),now:()=>now});assert.equal(job.status,'scheduled');assert.deepEqual(saved.map(j=>j.status),['submitting','unverified','scheduled']);assert.match(calls[1],/startDate=.*endDate=/);
  await assert.rejects(verifyPostizJob(job,{client:async()=>({posts:[readback.posts[0]]}),save:async()=>assert.fail()}),/does not match/);
  await assert.rejects(verifyPostizJob({...job,postIds:[refs[0]]},{client:async()=>readback,save:async()=>assert.fail()}),/incomplete/);
});
test('Postiz uncertain creation is retained and cannot be blindly retried',async()=>{
  const saved=[],payload=postizPayload(draft,upload,now);let writes=0;
  await assert.rejects(submitPostizJob({id:'uncertain',payload},{client:async()=>{writes++;throw new Error('network');},save:async row=>saved.push(row),now:()=>now}),/will not be resent/);
  assert.equal(writes,1);assert.equal(saved.at(-1).status,'uncertain');await assert.rejects(submitPostizJob(saved.at(-1),{client:async()=>assert.fail(),save:async()=>assert.fail(),now:()=>now}),/cannot be resubmitted/);
});
test('local kit saves edited caption and selected media before calendar/alarm; partial downloads block reminder',async()=>{
  validateLocal(draft);assert.throws(()=>validateLocal({...draft,localTargets:[]}),/platform/);const calls=[];
  const job=await createLocalKit(draft,{id:()=> 'local-id',now:()=>now,download:async post=>{calls.push('download');assert.equal(post.caption,draft.caption);assert.deepEqual(post.media,draft.media);assert.equal(post.media_count,1);return{state:'complete',folder:'Instagram/sample.account/Test_time'};},text:async(content,path,mime)=>{calls.push('calendar');assert.match(content,/BEGIN:VCALENDAR/);assert.match(path,/posting-reminder.ics$/);assert.equal(mime,'text/calendar;charset=utf-8');},register:async row=>{calls.push('register');return{ok:true,job:row};}});
  assert.deepEqual(calls,['download','calendar','register']);assert.equal(job.provider,'local');assert.equal(job.status,'reminder');assert.equal(job.notifications,false);
  await assert.rejects(createLocalKit(draft,{now:()=>now,download:async()=>({state:'partial'}),text:async()=>assert.fail(),register:async()=>assert.fail()}),/incomplete/);
});
test('calendar export uses UTC, escapes injected lines and folds UTF-8 by octet count',()=>{
  const job={id:'local-id',username:'example',labels:['Instagram'],createdAt:new Date(now).toISOString(),payload:{scheduledFor:when},source:draft.post.post_url,folder:'Instagram/example/Test_time',caption:'💜'.repeat(80)+'\r\nEND:VEVENT;bad,value'};
  const ics=calendarText(job);assert.match(ics,/DTSTART:20261010T160000Z\r\n/);assert.equal(ics.split('\r\n').filter(l=>l==='END:VEVENT').length,1);assert.match(ics.replace(/\r\n /g,''),/\\nEND:VEVENT\\;bad\\,value/);for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
test('reminder worker persists, restores after restart, notifies once, cancels, and rejects untrusted senders',async()=>{
  const stored={},alarms=new Map(),notifications=[],events={};let clock=now;
  class FakeDate extends Date{static now(){return clock;}}
  const chrome={runtime:{id:'extension',getURL:p=>'chrome-extension://extension/'+p,onStartup:{addListener:fn=>events.startup=fn},onInstalled:{addListener:fn=>events.installed=fn}},storage:{local:{get:async key=>key===null?{...stored}:{[key]:stored[key]},set:async values=>Object.assign(stored,values)}},permissions:{contains:async()=>true},alarms:{create:async(name,value)=>alarms.set(name,value),clear:async name=>alarms.delete(name),onAlarm:{addListener:fn=>events.alarm=fn}},notifications:{create:async(name,value)=>notifications.push({name,value}),clear:async()=>{},onClicked:{addListener:fn=>events.click=fn}},tabs:{create:async()=>{}}};
  const notificationAPI=chrome.notifications;chrome.notifications=undefined;chrome.permissions.onAdded={addListener:fn=>events.permission=fn};
  const context={chrome,URL,Date:FakeDate};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../reminders-worker.js',import.meta.url),'utf8'),context);
  assert.equal(events.click,undefined);chrome.notifications=notificationAPI;events.permission({permissions:['notifications']});assert.equal(typeof events.click,'function');
  const sender={id:'extension',frameId:0,url:'chrome-extension://extension/schedule.html'},job={id:'local-id',provider:'local',status:'reminder',username:'sample',caption:draft.caption,source:draft.post.post_url,labels:['Instagram'],folder:'Instagram/sample/Test_time',notifications:true,payload:{scheduledFor:when}};
  const send=(message,who=sender)=>new Promise(resolve=>context.SwoopReminders.handle(message,who,resolve));
  assert.equal((await send({action:'add',job})).ok,true);assert.equal(alarms.get('swoop.reminder.local-id').when,Date.parse(when));assert.equal((await send({action:'add',job:{...job,id:'bad'}},{...sender,url:'https://www.instagram.com/'})).ok,false);
  assert.equal((await send({action:'add',job:{...job,id:'past',payload:{scheduledFor:new Date(now).toISOString()}}})).ok,false);
  alarms.clear();events.startup();await new Promise(r=>setImmediate(r));assert.ok(alarms.has('swoop.reminder.local-id'));
  clock=Date.parse(when)+1;events.alarm({name:'swoop.reminder.local-id'});await new Promise(r=>setImmediate(r));assert.equal(stored['swoop.schedule.local-id'].status,'due');assert.equal(notifications.length,1);events.alarm({name:'swoop.reminder.local-id'});await new Promise(r=>setImmediate(r));assert.equal(notifications.length,1);
  assert.equal((await send({action:'cancel',id:'local-id'})).ok,true);assert.equal(stored['swoop.schedule.local-id'].status,'cancelled');
});
