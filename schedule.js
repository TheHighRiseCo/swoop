import {collectPost} from './collector.js';
import {makeClient,listAccounts,zonedTime,futureTime,validateSelection,uploadMedia,schedulePayload,submitJob,verifyJob,SCHEDULE_ORIGINS,KEY_NAME,JOB_PREFIX} from './scheduler.js';
import {POSTIZ_KEY,postizOrigin,makePostizClient,listPostizAccounts,uploadPostizMedia,postizPayload,submitPostizJob,verifyPostizJob} from './postiz.js';
import {validateLocal,createLocalKit,LOCAL_PLATFORMS} from './local-schedule.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),tabId=Number(params.get('tab')),targetURL=params.get('post');
const sourceCode=url=>{try{return new URL(url).pathname.match(/^\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)\/?$/)?.[1];}catch{return undefined;}};
const providerName=value=>({zernio:'Zernio',postiz:'Postiz',local:'Local'}[value]);
const jobProvider=job=>job.provider||'zernio';
const provider=()=>$('provider').value,mode=()=>$('postiz-mode').value;
const dashboard=(value,hosting='cloud')=>value==='postiz'?(hosting==='local'?'http://127.0.0.1:4007':'https://platform.postiz.com'):'https://zernio.com/dashboard';
let post,accounts=[],draft,client,busy=false,lockedJob,connectionMode;
const status=(text,error=false)=>{$('status').textContent=text;$('status').className=error?'error':'';};
function lock(value){busy=value;for(const el of document.querySelectorAll('button,input,textarea,select'))el.disabled=value;}
function invalidates(){draft=undefined;$('confirmation').hidden=true;}
async function saveJob(job){await chrome.storage.local.set({[JOB_PREFIX+job.id]:job});await history();}
async function history(){
  const stored=await chrome.storage.local.get(null),jobs=Object.entries(stored).filter(([key])=>key.startsWith(JOB_PREFIX)).map(([,job])=>job).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $('history').replaceChildren();$('no-history').hidden=!!jobs.length;
  lockedJob=jobs.find(j=>sourceCode(j.source)&&sourceCode(j.source)===sourceCode(post?.post_url||targetURL)&&['submitting','uncertain','unverified'].includes(j.status));
  for(const job of jobs.slice(0,20)){
    const service=jobProvider(job),li=document.createElement('li'),body=document.createElement('div'),line=document.createElement('p'),when=job.payload.scheduledFor||job.payload.date;
    const ids=job.postIds?.map(r=>r.postId).join(', ')||job.postId;
    line.textContent=`${providerName(service)} · ${job.status==='scheduled'?'Schedule verified':job.status==='reminder'?'Manual reminder set':job.status==='due'?'Due — post manually':job.status} · ${new Date(when).toLocaleString()} · ${job.payload.timezone||job.timezone||''}\n${job.labels.join(', ')}${ids?` · IDs ${ids}`:''}${job.error?'\n'+job.error:''}`;body.append(line);
    const a=document.createElement('a');a.href=service==='local'?'reminders.html':dashboard(service,job.mode);a.target='_blank';a.rel='noopener noreferrer';a.textContent=service==='local'?'Manage local reminder ↗':`Open ${providerName(service)} dashboard ↗`;body.append(a);
    if(['submitting','uncertain','unverified'].includes(job.status)){
      if(service==='zernio'||job.postIds?.length){const button=document.createElement('button');button.textContent=service==='zernio'&&!job.postId?'Retry same request':'Check status';button.disabled=busy;button.addEventListener('click',()=>recover(job));body.append(button);}
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.style.width='18px';label.append(check,document.createTextNode(' I checked and resolved this submission in the provider dashboard.'));
      const resolve=document.createElement('button');resolve.textContent='Resolve local receipt';resolve.disabled=true;check.addEventListener('change',()=>{resolve.disabled=busy||!check.checked;});resolve.addEventListener('click',async()=>{if(busy||!check.checked)return;lock(true);try{await saveJob({...job,status:'resolved',resolvedAt:new Date().toISOString()});invalidates();status('Local receipt resolved. This does not cancel or change any provider post.');}catch(error){status(error.message,true);}finally{lock(false);await history();}});body.append(label,resolve);
    }li.append(body);$('history').append(li);
  }
}
async function recover(job){
  if(busy)return;lock(true);
  try{const service=jobProvider(job);if(!client||provider()!==service||(service==='postiz'&&connectionMode!==job.mode))throw new Error(`Connect the original ${providerName(service)} account and hosting option before checking this receipt.`);
    const result=service==='postiz'?await verifyPostizJob(job,{client,save:saveJob}):job.postId?await verifyJob(job,{client,save:saveJob}):await submitJob(job,{client,save:saveJob});status(`Schedule verified with ${providerName(service)}. ${result.postId||result.postIds.map(r=>r.postId).join(', ')}`);
  }catch(error){status(error.message,true);}finally{lock(false);await history();}
}
function renderAccounts(){
  $('accounts').replaceChildren();if(!accounts.length){$('accounts').textContent=`Connect supported accounts in ${providerName(provider())} and refresh. No destination is selected automatically.`;return;}
  for(const a of accounts){const row=document.createElement('div');row.className='account-row';const input=document.createElement('input');input.type='checkbox';input.value=a.id;input.id='account-'+a.id;input.addEventListener('change',invalidates);const label=document.createElement('label');label.htmlFor=input.id;label.textContent=`${a.platform==='twitter'?'X':a.platform} · @${a.username.replace(/^@/,'')}${a.provider==='linkedin-page'?' · Company page':''}${a.profile?' · '+a.profile:''}`;row.append(input,label);$('accounts').append(row);}
}
function setMethod(){
  invalidates();accounts=[];client=undefined;connectionMode=undefined;$('api-key').value='';const service=provider(),local=service==='local';
  $('connector').hidden=local;$('postiz-config').hidden=service!=='postiz';$('remote-targets').hidden=local;$('local-targets').hidden=!local;
  $('connect-heading').textContent=`Connect ${providerName(service)}`;$('key-label').textContent=`${providerName(service)} API key`;
  $('connection').textContent='Enter the chosen provider’s API key. Keys stay in the current Chrome session. Codex/NexusOS connections are separate.';
  $('manage-provider').href=dashboard(service,mode());
  $('method-hint').textContent=local?'Save files, the edited caption, a calendar file, and a manual posting reminder. No media is uploaded to a scheduler.':'The selected provider uploads and publishes your reviewed post. One provider is used per submission.';
  $('timing-hint').textContent=local?'Choose at least two minutes ahead. Chrome reminders may be delayed while Chrome is closed or your computer sleeps. Import the calendar file for a separate reminder.':'Choose at least two minutes ahead. Keep this page open until upload and schedule verification finish. The provider handles future publication.';
  $('confirm').textContent=local?'Save posting kit and reminder':'Confirm and schedule';renderAccounts();
}
async function restoreConnection(){
  if(provider()==='local')return;const service=provider(),hosting=mode(),keyName=service==='zernio'?KEY_NAME:POSTIZ_KEY;
  const stored=await chrome.storage.session.get(keyName),saved=stored[keyName];if(!saved)return;
  if(service==='postiz'&&saved.mode!==hosting)return;
  const key=service==='zernio'?saved:saved.key,candidate=service==='zernio'?makeClient(key):makePostizClient(key,hosting);
  const rows=service==='zernio'?await listAccounts(candidate):await listPostizAccounts(candidate);
  if(provider()!==service||mode()!==hosting)return;client=candidate;accounts=rows;connectionMode=hosting;renderAccounts();$('connection').textContent=`Connected for this browser session · ${accounts.length} supported accounts. None selected automatically.`;
}
async function changeMethod(){if(busy)return;lock(true);setMethod();try{await chrome.storage.local.set({'swoop.scheduler.choice':provider(),'swoop.postiz.mode':mode()});await restoreConnection();status(provider()==='local'?'Select platforms for your manual posting reminder.':'Choose an account or connect the selected provider.');}catch(error){status(error.message,true);}finally{lock(false);await history();}}
$('provider').addEventListener('change',changeMethod);$('postiz-mode').addEventListener('change',changeMethod);
async function connect(){
  if(busy||provider()==='local')return;const service=provider(),hosting=mode();const permission=chrome.permissions.request({origins:[service==='zernio'?'https://zernio.com/*':postizOrigin(hosting)]});lock(true);
  try{if(!await permission)throw new Error('Allow access to the selected scheduler to connect.');const keyName=service==='zernio'?KEY_NAME:POSTIZ_KEY,stored=await chrome.storage.session.get(keyName),saved=stored[keyName],key=$('api-key').value.trim()||(service==='zernio'?saved:saved?.mode===hosting?saved.key:undefined);
    const candidate=service==='zernio'?makeClient(key):makePostizClient(key,hosting),rows=service==='zernio'?await listAccounts(candidate):await listPostizAccounts(candidate);
    await chrome.storage.session.set({[keyName]:service==='zernio'?key:{key,mode:hosting}});client=candidate;accounts=rows;connectionMode=hosting;$('api-key').value='';invalidates();renderAccounts();$('connection').textContent=`Connected for this browser session · ${accounts.length} supported accounts. None selected automatically.`;status('Choose the media, account, and time.');
  }catch(error){client=undefined;accounts=[];renderAccounts();$('connection').textContent='Connection failed. Check the key, provider access, and account setup.';status(error.message,true);}finally{lock(false);await history();}
}
$('connect').addEventListener('click',connect);
$('disconnect').addEventListener('click',async()=>{if(busy)return;lock(true);try{await chrome.storage.session.remove(provider()==='zernio'?KEY_NAME:POSTIZ_KEY);client=undefined;accounts=[];renderAccounts();invalidates();$('connection').textContent='Disconnected from SWOOP. Existing provider schedules stay active; manage them in the provider dashboard.';}catch(error){status(error.message,true);}finally{lock(false);await history();}});
async function scan(){
  if(busy)return;lock(true);invalidates();post=undefined;$('editor').hidden=true;
  try{if(!Number.isInteger(tabId)||tabId<=0)throw new Error('Open Schedule from a SWOOP preview or bulk queue.');const [result]=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:collectPost,args:[targetURL||null]});if(!result?.result?.ok)throw new Error(result?.result?.error||'Could not read the selected post.');
    post=result.result.post;$('username').textContent=`@${post.username} · ${post.media_count} items`;$('source').href=post.post_url;$('caption').value=post.caption;$('media-select').replaceChildren();
    for(const item of post.media){const li=document.createElement('li'),label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.value=String(item.index);input.addEventListener('change',invalidates);label.textContent=`${String(item.index).padStart(2,'0')} · ${item.type}`;label.prepend(input);li.append(label);if(item.type==='image'){const img=document.createElement('img');img.src=item.url;img.alt=`Media item ${item.index}`;img.referrerPolicy='no-referrer';li.append(img);}else{const icon=document.createElement('div');icon.className='video-placeholder';icon.textContent='▶';li.append(icon);}$('media-select').append(li);}
    $('editor').hidden=false;status('Choose the scheduler and review your post.');
  }catch(error){status(error.message,true);}finally{lock(false);await history();}
}
$('scan').addEventListener('click',scan);for(const id of ['caption','when','timezone'])$(id).addEventListener('input',invalidates);for(const input of $('local-targets').querySelectorAll('input'))input.addEventListener('change',invalidates);
$('review').addEventListener('click',async()=>{
  if(busy)return;lock(true);
  try{await history();if(!post)throw new Error('Read the post first.');const service=provider();if(service!=='local'&&!client)throw new Error(`Connect ${providerName(service)} first.`);if(service!=='local'&&lockedJob)throw new Error('This source has an unconfirmed submission. Resolve or check it in Recent schedules before creating another.');
    const chosen=new Set([...$('accounts').querySelectorAll('input:checked')].map(el=>el.value)),indices=new Set([...$('media-select').querySelectorAll('input:checked')].map(el=>Number(el.value)));
    const next={provider:service,mode:mode(),post,caption:$('caption').value,accounts:accounts.filter(a=>chosen.has(a.id)),media:post.media.filter(m=>indices.has(m.index)),localTargets:[...$('local-targets').querySelectorAll('input:checked')].filter(el=>el.id!=='local-notify').map(el=>el.value),notifications:$('local-notify').checked,timezone:$('timezone').value.trim(),scheduledFor:zonedTime($('when').value,$('timezone').value.trim())};
    service==='local'?validateLocal(next):validateSelection(next);futureTime(next.scheduledFor);draft=structuredClone(next);
    $('review-text').textContent=`Method: ${providerName(service)}${service==='postiz'?' · '+(next.mode==='local'?'Local Postiz server':'Cloud'):''}\nSource: @${post.username} · ${post.post_url}\n${service==='local'?'Manual platforms':'Destination accounts'}: ${service==='local'?next.localTargets.map(t=>LOCAL_PLATFORMS[t]).join(', '):next.accounts.map(a=>`${a.platform==='twitter'?'X':a.platform} · @${a.username.replace(/^@/,'')}`).join(', ')}\nWhen: ${$('when').value.replace('T',' ')} (${next.timezone})\nMedia: ${next.media.map(m=>`${m.index} ${m.type}`).join(', ')}\n\nCaption:\n${next.caption||'(No caption)'}\n\n${service==='local'?'Confirming saves files, the edited caption, an .ics calendar file, and a local reminder. You must publish manually. Chrome notification: '+(next.notifications?'requested if allowed.':'off.'):`Confirming uploads the selected media and caption to ${providerName(service)} and schedules publication to these accounts.`}`;
    $('confirmation').hidden=false;status('Review the method, destination, time, and caption before confirming.');
  }catch(error){invalidates();status(error.message,true);}finally{lock(false);await history();}
});
$('edit').addEventListener('click',invalidates);
$('confirm').addEventListener('click',async()=>{
  if(!draft||busy)return;const confirmed=structuredClone(draft),service=confirmed.provider;
  const permission=service==='local'?(confirmed.notifications?chrome.permissions.request({permissions:['notifications']}):Promise.resolve(false)):chrome.permissions.request({origins:service==='zernio'?SCHEDULE_ORIGINS:[postizOrigin(confirmed.mode),'https://*.cdninstagram.com/*','https://*.fbcdn.net/*']});lock(true);
  try{const allowed=await permission;futureTime(confirmed.scheduledFor);
    if(service==='local'){const job=await createLocalKit(confirmed,{notifications:allowed,register:job=>chrome.runtime.sendMessage({type:'SWOOP_LOCAL_REMINDER',action:'add',job}),onProgress:progress=>status(typeof progress==='string'?progress:`Saving media ${progress.index}/${progress.total}…`)});invalidates();status(`Posting kit and calendar saved to Downloads/${job.folder}. Local reminder set${job.notifications?' with a Chrome notification':''}. You must publish manually.`);}
    else{if(!allowed)throw new Error('Allow media and scheduler access to schedule.');validateSelection(confirmed);const uploaded=service==='zernio'?await uploadMedia(confirmed.post,confirmed.media,confirmed.accounts,{client,onProgress:status}):await uploadPostizMedia(confirmed.post,confirmed.media,{client,mode:confirmed.mode,onProgress:status});
      const payload=service==='zernio'?schedulePayload(confirmed,uploaded):postizPayload(confirmed,uploaded),job={id:crypto.randomUUID(),provider:service,mode:confirmed.mode,timezone:confirmed.timezone,source:confirmed.post.post_url,labels:confirmed.accounts.map(a=>`${a.platform} · @${a.username}`),createdAt:new Date().toISOString(),payload};
      status(`Submitting the reviewed schedule to ${providerName(service)}…`);const receipt=service==='zernio'?await submitJob(job,{client,save:saveJob,onProgress:status}):await submitPostizJob(job,{client,save:saveJob});invalidates();status(`Schedule verified with ${providerName(service)}. IDs: ${receipt.postId||receipt.postIds.map(r=>r.postId).join(', ')}. Check the provider for eventual publishing status.`);
    }
  }catch(error){invalidates();status(error.message,true);}finally{lock(false);await history();}
});
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&!busy&&Object.keys(changes).some(k=>k.startsWith(JOB_PREFIX)))history().catch(e=>status(e.message,true));});
$('timezone').value=Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Los_Angeles';
try{const saved=await chrome.storage.local.get(null);if(['zernio','postiz','local'].includes(saved['swoop.scheduler.choice']))$('provider').value=saved['swoop.scheduler.choice'];if(['cloud','local'].includes(saved['swoop.postiz.mode']))$('postiz-mode').value=saved['swoop.postiz.mode'];}catch(error){status(error.message,true);}
setMethod();await scan();lock(true);try{await restoreConnection();}catch(error){status(error.message,true);}finally{lock(false);await history();}
