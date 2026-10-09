// Classic service-worker companion. Reminder jobs never publish or upload content.
(() => {
  const prefix='swoop.schedule.', alarmPrefix='swoop.reminder.';
  let writes=Promise.resolve();
  const enqueue=fn=>{const work=writes.then(fn);writes=work.catch(()=>{});return work;};
  function trusted(sender){if(sender.id!==chrome.runtime.id||sender.frameId!==0||!sender.url?.startsWith(chrome.runtime.getURL('')))throw new Error('Only SWOOP pages can manage reminders.');}
  async function due(id){
    const key=prefix+id,stored=await chrome.storage.local.get(key),job=stored[key];
    if(job?.provider!=='local'||job.status!=='reminder')return;
    if(Date.parse(job.payload.scheduledFor)>Date.now()){await chrome.alarms.create(alarmPrefix+id,{when:Date.parse(job.payload.scheduledFor)});return;}
    const updated={...job,status:'due',dueAt:new Date().toISOString()};
    await chrome.storage.local.set({[key]:updated});
    if(job.notifications&&await chrome.permissions.contains({permissions:['notifications']})){
      try{await chrome.notifications.create(alarmPrefix+id,{type:'basic',iconUrl:chrome.runtime.getURL('icons/icon-128.png'),title:'SWOOP · Time to post',message:`Your saved posting kit is ready for ${job.labels.join(', ')}. Click to open the reminder.`,priority:1});}
      catch(error){await chrome.storage.local.set({[key]:{...updated,notificationError:error.message}});}
    }
  }
  async function restore(){const stored=await chrome.storage.local.get(null);for(const job of Object.values(stored)){if(job?.provider==='local'&&job.status==='reminder'){const when=Date.parse(job.payload?.scheduledFor);if(!Number.isFinite(when))continue;if(when<=Date.now())await due(job.id);else await chrome.alarms.create(alarmPrefix+job.id,{when});}}}
  function validate(job){
    const when=Date.parse(job?.payload?.scheduledFor),source=new URL(job?.source);
    if(job?.provider!=='local'||job.status!=='reminder'||!/^[A-Za-z0-9_-]{1,80}$/.test(job.id)||!Number.isFinite(when)||when-Date.now()<120000||typeof job.caption!=='string'||job.caption.length>100000||!Array.isArray(job.labels)||!job.labels.length||job.labels.some(s=>!['Instagram','LinkedIn','X'].includes(s))||typeof job.username!=='string'||!/^Instagram\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(job.folder)||job.folder.split('/').some(s=>s==='..')||source.protocol!=='https:'||!['www.instagram.com','instagram.com'].includes(source.hostname)||source.port||source.username||source.password||!/^\/(?:p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?$/.test(source.pathname))throw new Error('Invalid local reminder.');
  }
  async function change(message,sender){
    trusted(sender);
    if(message.action==='add'){
      const job=message.job;validate(job);const all=await chrome.storage.local.get(null),key=prefix+job.id;
      if(all[key])throw new Error('This reminder already exists.');
      if(Object.values(all).filter(j=>j?.provider==='local'&&j.status==='reminder').length>=100)throw new Error('Up to 100 active local reminders are supported.');
      const saved={...job,notifications:!!job.notifications&&await chrome.permissions.contains({permissions:['notifications']})};
      await chrome.storage.local.set({[key]:saved});
      try{await chrome.alarms.create(alarmPrefix+job.id,{when:Date.parse(job.payload.scheduledFor)});}catch(error){await chrome.storage.local.set({[key]:{...saved,status:'reminder_error',error:error.message}});throw error;}
      return {ok:true,job:saved};
    }
    if(message.action==='cancel'){
      if(!/^[A-Za-z0-9_-]{1,80}$/.test(message.id))throw new Error('Invalid reminder ID.');const key=prefix+message.id,stored=await chrome.storage.local.get(key),job=stored[key];
      if(job?.provider!=='local')throw new Error('Local reminder not found.');
      await chrome.alarms.clear(alarmPrefix+message.id);await chrome.storage.local.set({[key]:{...job,status:'cancelled'}});
      if(await chrome.permissions.contains({permissions:['notifications']}))await chrome.notifications.clear(alarmPrefix+message.id);
      return {ok:true};
    }
    throw new Error('Unknown reminder action.');
  }
  globalThis.SwoopReminders={handle(message,sender,respond){enqueue(()=>change(message,sender)).then(respond,error=>respond({ok:false,error:error.message}));return true;}};
  chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name.startsWith(alarmPrefix))enqueue(()=>due(alarm.name.slice(alarmPrefix.length)));});
  chrome.runtime.onStartup.addListener(()=>enqueue(restore));
  chrome.runtime.onInstalled.addListener(()=>enqueue(restore));
  let notificationClickAttached=false;
  function attachNotificationClick(){
    if(notificationClickAttached||!chrome.notifications?.onClicked)return;
    chrome.notifications.onClicked.addListener(id=>{if(id.startsWith(alarmPrefix))chrome.tabs.create({url:chrome.runtime.getURL('reminders.html')});});
    notificationClickAttached=true;
  }
  chrome.permissions.onAdded?.addListener(permission=>{if(permission.permissions?.includes('notifications'))attachNotificationClick();});
  attachNotificationClick();
  enqueue(restore);
})();
