import {readMedia,futureTime,validateSelection} from './scheduler.js';
export const POSTIZ_KEY='swoop.postiz.session';
export const POSTIZ_BASES={cloud:'https://api.postiz.com/public/v1',local:'http://127.0.0.1:4007/api/public/v1'};
export function postizOrigin(mode){if(!POSTIZ_BASES[mode])throw new Error('Choose Postiz Cloud or local Postiz.');return mode==='cloud'?'https://api.postiz.com/*':'http://127.0.0.1/*';}
export function postizMediaPath(value,mode){
  const u=new URL(value),base=new URL(POSTIZ_BASES[mode]);
  if(u.username||u.password||!((u.protocol==='https:'&&u.hostname==='uploads.postiz.com'&&!u.port)||(mode==='local'&&u.origin===base.origin)))throw new Error('Postiz returned an unsupported media location. No schedule was submitted.');
  return u.href;
}
export function makePostizClient(key,mode='cloud',transport=fetch){
  postizOrigin(mode);if(!key?.trim())throw new Error('Enter your Postiz API key.');
  return async(path,{method='GET',body}={})=>{
    if(!/^\/(?:integrations|upload|posts(?:\?[^#]*)?)$/.test(path))throw new Error('Unsupported Postiz endpoint.');
    const multipart=body instanceof FormData;
    let response;try{response=await transport(POSTIZ_BASES[mode]+path,{method,headers:{Authorization:key,...(body&&!multipart?{'Content-Type':'application/json'}:{})},body:body?(multipart?body:JSON.stringify(body)):undefined,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(180000)});}catch{throw new Error('Postiz did not respond. A submitted schedule may still have been saved.');}
    const data=await response.json().catch(()=>null);
    if(!response.ok||response.status===207||data===null)throw new Error(typeof data?.message==='string'?data.message:`Postiz returned an invalid response (HTTP ${response.status}).`);
    return data;
  };
}
export async function listPostizAccounts(client){
  const rows=await client('/integrations');if(!Array.isArray(rows))throw new Error('Postiz did not return a channel list.');
  const platform={instagram:'instagram','instagram-standalone':'instagram',linkedin:'linkedin','linkedin-page':'linkedin',x:'twitter'};
  return rows.filter(a=>a.id&&platform[a.identifier]&&a.disabled===false).map(a=>({id:a.id,platform:platform[a.identifier],provider:a.identifier,username:a.profile||a.name||a.id,profile:a.customer?.name||''}));
}
export async function uploadPostizMedia(post,media,{client,mode='cloud',transport=fetch,onProgress=()=>{}}){
  const uploaded=[];
  for(const item of media){onProgress(`Uploading item ${uploaded.length+1} of ${media.length} to Postiz…`);const {blob,contentType,filename}=await readMedia(post,item,transport);const form=new FormData();form.append('file',new Blob([blob],{type:contentType}),filename);const result=await client('/upload',{method:'POST',body:form});if(typeof result.id!=='string'||!result.id)throw new Error('Postiz did not return a media ID.');uploaded.push({id:result.id,path:postizMediaPath(result.path,mode)});}
  return uploaded;
}
export function postizPayload(draft,uploaded,now=Date.now()){
  validateSelection(draft);if(uploaded.length!==draft.media.length)throw new Error('Not every selected media item was uploaded.');
  return {type:'schedule',date:futureTime(draft.scheduledFor,now),shortLink:false,tags:[],posts:draft.accounts.map(a=>{
    const settings={__type:a.provider};
    if(a.platform==='instagram'){if(!['instagram','instagram-standalone'].includes(a.provider))throw new Error('Invalid Instagram channel.');settings.post_type='post';settings.is_trial_reel=false;settings.collaborators=[];}
    else if(a.platform==='twitter'){if(a.provider!=='x')throw new Error('Invalid X channel.');settings.who_can_reply_post='everyone';}
    else if(!['linkedin','linkedin-page'].includes(a.provider))throw new Error('Invalid LinkedIn channel.');
    return {integration:{id:a.id},value:[{content:draft.caption,image:uploaded}],settings};
  })};
}
export async function verifyPostizJob(job,{client,save}){
  if(!job.postIds?.length)throw new Error('No Postiz IDs were returned. Check Postiz manually; SWOOP will not resubmit automatically.');
  const time=Date.parse(job.payload.date),q=new URLSearchParams({startDate:new Date(time-60000).toISOString(),endDate:new Date(time+60000).toISOString()});
  const data=await client('/posts?'+q);if(!Array.isArray(data.posts))throw new Error('Postiz did not return saved posts.');
  const expected=job.payload.posts.map(p=>p.integration.id).sort(),returned=job.postIds.map(p=>p.integration).sort();
  if(JSON.stringify(expected)!==JSON.stringify(returned))throw new Error('Postiz returned an incomplete or mismatched destination list. Check its dashboard.');
  for(const ref of job.postIds){const row=data.posts.find(p=>p.id===ref.postId),request=job.payload.posts.find(p=>p.integration.id===ref.integration);if(!row||row.state!=='QUEUE'||Date.parse(row.publishDate)!==time||row.integration?.id!==ref.integration||row.integration?.providerIdentifier!==request.settings.__type||row.content!==request.value[0].content)throw new Error('Postiz readback does not match the reviewed schedule. Check its dashboard.');}
  const result={...job,status:'scheduled',error:undefined,verifiedAt:new Date().toISOString()};await save(result);return result;
}
export async function submitPostizJob(job,{client,save,now=()=>Date.now()}){
  if(job.status)throw new Error('Postiz requests cannot be resubmitted. Check the original submission in Postiz.');
  futureTime(job.payload.date,now());if(job.payload.type!=='schedule'||!job.payload.posts?.length)throw new Error('Invalid Postiz scheduling request.');
  let record={...job,status:'submitting'};await save(record);
  try{const rows=await client('/posts',{method:'POST',body:job.payload});if(!Array.isArray(rows)||!rows.length||rows.some(r=>typeof r.postId!=='string'||typeof r.integration!=='string'))throw new Error('Postiz did not return valid post IDs.');record={...record,status:'unverified',postIds:rows};await save(record);return await verifyPostizJob(record,{client,save});}
  catch(error){record={...record,status:record.postIds?'unverified':'uncertain',error:error.message};await save(record);throw new Error(`${error.message} Check Postiz before creating another schedule. This request will not be resent.`);}
}
