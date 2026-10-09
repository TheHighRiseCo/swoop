import {JOB_PREFIX} from './scheduler.js';
import {calendarText} from './local-schedule.js';
import {saveText} from './downloads.js';
import {safeSegment} from './files.js';
const $=id=>document.getElementById(id);let busy=false;
const status=(message,error=false)=>{$('status').textContent=message;$('status').className=error?'error':'';};
async function act(fn){if(busy)return;busy=true;try{await fn();}catch(error){status(error.message,true);}finally{busy=false;await render();}}
async function render(){
  const all=await chrome.storage.local.get(null),jobs=Object.entries(all).filter(([key,j])=>key.startsWith(JOB_PREFIX)&&j.provider==='local').map(([,j])=>j).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $('empty').hidden=!!jobs.length;$('reminders').replaceChildren();
  for(const job of jobs){const li=document.createElement('li'),body=document.createElement('div'),line=document.createElement('p');line.textContent=`${job.status==='reminder'?'Reminder set':job.status==='due'?'Due — post manually':job.status} · ${new Date(job.payload.scheduledFor).toLocaleString()} · ${job.payload.timezone}\n${job.labels.join(', ')} · @${job.username}\nDownloads/${job.folder}${job.error?'\n'+job.error:''}${job.notificationError?'\nNotification failed: '+job.notificationError:''}`;
    const a=document.createElement('a');a.href=job.source;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Original Instagram post ↗';const caption=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('p');summary.textContent='Saved caption';text.textContent=job.caption;caption.append(summary,text);
    const buttons=document.createElement('div');buttons.className='toolbar';const calendar=document.createElement('button');calendar.textContent='Export calendar reminder';calendar.disabled=busy;calendar.addEventListener('click',()=>act(async()=>{await saveText(calendarText(job),`SWOOP/${safeSegment(job.username)}_${job.id}_reminder.ics`,'text/calendar;charset=utf-8');status('Calendar file downloaded. Import it into your calendar.');}));buttons.append(calendar);
    if(job.status!=='cancelled'){const cancel=document.createElement('button');cancel.textContent='Cancel Chrome reminder';cancel.disabled=busy;cancel.addEventListener('click',()=>act(async()=>{const result=await chrome.runtime.sendMessage({type:'SWOOP_LOCAL_REMINDER',action:'cancel',id:job.id});if(!result?.ok)throw new Error(result?.error||'Reminder cancellation failed.');status('Chrome reminder cancelled. Imported calendar events need separate cancellation.');}));buttons.append(cancel);}
    body.append(line,a,caption,buttons);li.append(body);$('reminders').append(li);
  }
}
$('downloads').addEventListener('click',()=>act(()=>chrome.downloads.showDefaultFolder()));$('refresh').addEventListener('click',()=>act(async()=>{status('Reminders refreshed.');}));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&!busy&&Object.keys(changes).some(key=>key.startsWith(JOB_PREFIX)))render().catch(e=>status(e.message,true));});
await render();
