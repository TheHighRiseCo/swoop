import {safeSegment} from './files.js';
export const API_ORIGIN='https://zernio.com';
export const SCHEDULE_ORIGINS=['https://zernio.com/*','https://*.cdninstagram.com/*','https://*.fbcdn.net/*','https://*.r2.cloudflarestorage.com/*','https://media.zernio.com/*'];
export const KEY_NAME='swoop.zernio.session';
export const JOB_PREFIX='swoop.schedule.';
export function futureTime(iso, now=Date.now()) {
  if (!Number.isFinite(Date.parse(iso)) || Date.parse(iso)-now < 120000) throw new Error('Choose a time at least two minutes in the future.');
  return new Date(iso).toISOString();
}
export function zonedTime(local, zone) {
  const match=String(local).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if(!match)throw new Error('Choose a date and time.');
  const [,y,m,d,h,min]=match.map(Number), wall=Date.UTC(y,m-1,d,h,min);
  const test=new Date(wall);
  if(test.getUTCFullYear()!==y||test.getUTCMonth()!==m-1||test.getUTCDate()!==d||h>23||min>59)throw new Error('Invalid date or time.');
  let formatter;try{formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}catch{throw new Error('Enter a valid timezone, such as America/Los_Angeles.');}
  const wallAt=ms=>{const p=Object.fromEntries(formatter.formatToParts(new Date(ms)).filter(x=>x.type!=='literal').map(x=>[x.type,Number(x.value)]));return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);};
  const offsets=new Set();for(let delta=-86400000;delta<=86400000;delta+=21600000){const probe=wall+delta;offsets.add(wallAt(probe)-probe);}
  const candidates=[...offsets].map(offset=>wall-offset).filter(ms=>wallAt(ms)===wall);
  if(candidates.length!==1)throw new Error(candidates.length?'This time occurs twice when clocks change. Choose an unambiguous time.':'This time does not exist when clocks change. Choose another time.');
  return new Date(candidates[0]).toISOString();
}
export function validateSelection({accounts,media,caption}) {
  if(!accounts.length)throw new Error('Select the destination account.');
  if(!media.length)throw new Error('Select at least one media item.');
  if(typeof caption!=='string')throw new Error('Enter a caption.');
  const images=media.filter(x=>x.type==='image').length,videos=media.filter(x=>x.type==='video').length;
  if(images+videos!==media.length)throw new Error('Only photos and videos are supported.');
  for(const a of accounts){
    if(!a.id||!['instagram','linkedin','twitter'].includes(a.platform))throw new Error('Select a supported connected account.');
    if(a.platform==='instagram'&&(media.length>10||[...caption].length>2200))throw new Error('Instagram supports up to 10 items here and a caption up to 2,200 characters. Select fewer items or shorten the caption.');
    if(a.platform==='linkedin'&&(images>20||videos>1||(images&&videos)||[...caption].length>3000))throw new Error('LinkedIn needs photos only (up to 20), or one video, and up to 3,000 caption characters.');
    if(a.platform==='twitter'){
      const weighted=[...caption.replace(/https?:\/\/\S+/g,'x'.repeat(23))].reduce((n,c)=>{const v=c.codePointAt(0);return n+(v<=0x10ff||(v>=0x2000&&v<=0x200d)||(v>=0x2010&&v<=0x201f)||(v>=0x2032&&v<=0x2037)?1:2);},0);
      if(images>4||videos>1||(images&&videos)||weighted>280)throw new Error('X needs up to 4 photos or one video. Shorten the caption to fit the standard 280-character limit.');
    }
  }
}
function secureURL(value, allowed) {
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||!allowed(u.hostname))throw new Error('An unsupported media or upload URL was returned.');
  return u.href;
}
export function sourceURL(value){return secureURL(value,h=>['cdninstagram.com','fbcdn.net'].some(d=>h===d||h.endsWith('.'+d)));}
export function uploadURL(value){return secureURL(value,h=>h.endsWith('.r2.cloudflarestorage.com'));}
export function publicURL(value){return secureURL(value,h=>h==='media.zernio.com');}
export function makeClient(key, transport=fetch) {
  if(!key?.trim())throw new Error('Connect your Zernio API key first.');
  return async (path,{method='GET',body,requestKey}={})=>{
    if(!/^\/(?:accounts(?:\?[^#]*)?|media\/presign|posts(?:\/[A-Za-z0-9_-]+)?)$/.test(path))throw new Error('Unsupported scheduler endpoint.');
    let response;try{response=await transport(API_ORIGIN+'/api/v1'+path,{method,headers:{Authorization:`Bearer ${key}`, ...(body?{'Content-Type':'application/json'}:{}),...(requestKey?{'Idempotency-Key':requestKey}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(60000)});}catch{throw new Error('Zernio did not respond. Check your connection; a submitted post may still have been saved.');}
    const data=await response.json().catch(()=>({}));
    if(!response.ok||response.status===207){const error=new Error(data.error||data.message||`Zernio returned HTTP ${response.status}.`);error.status=response.status;throw error;}
    return data;
  };
}
export async function listAccounts(client){
  const data=await client('/accounts?status=connected&excludeHidden=true');
  if(!Array.isArray(data.accounts))throw new Error('Zernio did not return an account list.');
  return data.accounts.filter(a=>['instagram','linkedin','twitter'].includes(a.platform)&&a.isActive!==false&&a.enabled!==false).map(a=>({id:a._id,platform:a.platform,username:a.username||a.displayName||a._id,profile:a.profileId?.name||''}));
}
export async function readMedia(post,item,transport=fetch){
  const response=await transport(sourceURL(item.url),{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error('The Instagram media link expired or could not be read. Read the post again.');
  const maxSize=item.type==='image'?8*1024*1024:250*1024*1024;
  const advertised=Number(response.headers.get('content-length'));if(advertised>maxSize)throw new Error('This media file is too large for SWOOP scheduling.');
  const blob=await response.blob();if(!blob.size||blob.size>maxSize)throw new Error('This media file is empty or too large for SWOOP scheduling.');
  const head=new Uint8Array(await blob.slice(0,12).arrayBuffer());
  const jpg=head[0]===255&&head[1]===216&&head[2]===255,png=head[0]===137&&head[1]===80&&head[2]===78&&head[3]===71;
  const mp4=head[4]===102&&head[5]===116&&head[6]===121&&head[7]===112;
  const contentType=item.type==='video'&&mp4?'video/mp4':item.type==='image'&&jpg?'image/jpeg':item.type==='image'&&png?'image/png':null;
  if(!contentType)throw new Error('The media is not a supported JPEG, PNG, or MP4 file. No post was scheduled.');
  const extension=contentType==='image/png'?'png':item.type==='video'?'mp4':'jpg';
  const filename=`${safeSegment(post.username)}_${safeSegment(post.shortcode)}_${String(item.index).padStart(2,'0')}.${extension}`;
  return {blob,contentType,filename};
}
export async function uploadMedia(post, media, accounts, {client,transport=fetch,onProgress=()=>{}}){
  const uploaded=[];
  for(const item of media){
    onProgress(`Uploading item ${uploaded.length+1} of ${media.length}…`);
    const {blob,contentType,filename}=await readMedia(post,item,transport);
    const presigned=await client('/media/presign',{method:'POST',body:{filename,contentType,size:blob.size}});
    const target=uploadURL(presigned.uploadUrl),publicUrl=publicURL(presigned.publicUrl);
    const put=await transport(target,{method:'PUT',headers:{'Content-Type':contentType},body:blob,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(300000)});
    if(!put.ok)throw new Error(`Media upload failed (HTTP ${put.status}). No post was scheduled.`);
    uploaded.push({url:publicUrl,type:item.type});
  }
  return uploaded;
}
export function schedulePayload(draft,uploaded,now=Date.now()) {
  validateSelection(draft);
  if(uploaded.length!==draft.media.length)throw new Error('Not every selected media item was uploaded.');
  return {content:draft.caption,mediaItems:uploaded,title:`SWOOP · @${draft.post.username} · ${draft.post.shortcode}`,platforms:draft.accounts.map(a=>({platform:a.platform,accountId:a.id})),scheduledFor:futureTime(draft.scheduledFor,now),timezone:draft.timezone,isDraft:false,publishNow:false};
}
export async function submitJob(job,{client,save,onProgress=()=>{},now=()=>Date.now()}) {
  futureTime(job.payload.scheduledFor,now());
  if(!job.id||!job.payload.platforms?.length||job.payload.publishNow!==false||job.payload.isDraft!==false)throw new Error('Invalid scheduling request.');
  let record={...job,status:'submitting'};await save(record);
  try{
    const result=await client('/posts',{method:'POST',body:job.payload,requestKey:job.id});
    const postId=result.post?._id||result.post?.id;if(!postId)throw new Error('Zernio did not return a post ID. Check its dashboard before retrying.');
    record={...record,postId,status:'unverified'};await save(record);
    onProgress('Checking the saved schedule with Zernio…');
    return await verifyJob(record,{client,save});
  }catch(error){
    record={...record,status:record.postId?'unverified':'uncertain',error:error.message};await save(record);
    const problem=new Error(`${error.message} ${record.postId?'The provider returned a post ID; use Check status.':'The result is unconfirmed. Use Retry same request or check Zernio before creating another schedule.'}`);problem.job=record;throw problem;
  }
}
export async function verifyJob(job,{client,save}) {
  const data=await client('/posts/'+encodeURIComponent(job.postId)), post=data.post;
  const targets=(post?.platforms||[]).map(p=>`${p.platform}:${typeof p.accountId==='object'?p.accountId._id:p.accountId}`).sort();
  const returnedMedia=post?.mediaItems;
  const mediaMismatch=returnedMedia!==undefined&&(!Array.isArray(returnedMedia)||returnedMedia.length!==job.payload.mediaItems.length||returnedMedia.some((item,i)=>item.type!==job.payload.mediaItems[i].type));
  const expected=job.payload.platforms.map(p=>`${p.platform}:${p.accountId}`).sort();
  if(mediaMismatch||post?.status!=='scheduled'||Date.parse(post.scheduledFor)!==Date.parse(job.payload.scheduledFor)||JSON.stringify(targets)!==JSON.stringify(expected)||post.content!==job.payload.content)throw new Error('Zernio readback does not match the requested schedule. Check its dashboard.');
  const result={...job,status:'scheduled',verifiedAt:new Date().toISOString(),error:undefined};await save(result);return result;
}
