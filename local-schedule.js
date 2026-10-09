import {futureTime} from './scheduler.js';
import {safeSegment} from './files.js';
import {downloadBundle,saveText} from './downloads.js';
export const LOCAL_PLATFORMS={instagram:'Instagram',linkedin:'LinkedIn',twitter:'X'};
export function validateLocal(draft){if(!draft.media?.length)throw new Error('Select media for the posting kit.');if(typeof draft.caption!=='string'||!draft.localTargets?.length||draft.localTargets.some(t=>!LOCAL_PLATFORMS[t]))throw new Error('Select at least one platform for the manual posting reminder.');}
const escapeICS=value=>String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
function fold(line){let result='',bytes=0;for(const char of line){const count=new TextEncoder().encode(char).length;if(bytes+count>75){result+='\r\n ';bytes=1;}result+=char;bytes+=count;}return result;}
export function calendarText(job){
  const title=`Post @${job.username} content to ${job.labels.join(', ')}`;
  const description=`Manual posting reminder — SWOOP does not publish this post.\nFiles: Downloads/${job.folder}\nSource: ${job.source}\n\nCaption:\n${job.caption}`;
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SWOOP//Posting Reminder//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${escapeICS(job.id)}@swoop.local`,`DTSTAMP:${stamp(job.createdAt)}`,`DTSTART:${stamp(job.payload.scheduledFor)}`,`DTEND:${stamp(Date.parse(job.payload.scheduledFor)+900000)}`,`SUMMARY:${escapeICS(title)}`,`DESCRIPTION:${escapeICS(description)}`,'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0M',`DESCRIPTION:${escapeICS(title)}`,'END:VALARM','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
export async function createLocalKit(draft,{notifications=false,download=downloadBundle,text=saveText,register,now=()=>Date.now(),id=()=>crypto.randomUUID(),onProgress=()=>{}}){
  validateLocal(draft);futureTime(draft.scheduledFor,now());
  const selected={...draft.post,caption:draft.caption,media:structuredClone(draft.media),media_count:draft.media.length};
  onProgress('Saving the selected media and edited caption…');const result=await download(selected,onProgress);
  if(result.state!=='complete')throw new Error('The posting kit is incomplete. No local reminder was created. Check downloads and try again.');
  futureTime(draft.scheduledFor,now());
  const job={id:id(),provider:'local',status:'reminder',createdAt:new Date(now()).toISOString(),source:draft.post.post_url,username:draft.post.username,labels:draft.localTargets.map(t=>LOCAL_PLATFORMS[t]),caption:draft.caption,folder:result.folder,notifications,payload:{scheduledFor:draft.scheduledFor,timezone:draft.timezone}};
  await text(calendarText(job),`${result.folder}/${safeSegment(job.username)}_${safeSegment(draft.post.shortcode)}_posting-reminder.ics`,'text/calendar;charset=utf-8');
  futureTime(draft.scheduledFor,now());const response=await register(job);if(!response?.ok)throw new Error(`Files and calendar were saved, but the local reminder could not be registered: ${response?.error||'No response'}`);
  return response.job||job;
}
