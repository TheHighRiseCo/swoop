import {collectPost} from './collector.js';
import {downloadBundle} from './downloads.js';
import {parseLinks,mergeLinks,runBatch,changeQueue,QUEUE_KEY} from './queue.js';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search), tabId=Number(params.get('tab'));
let links=[], selected=new Set(), results=new Map(), running=false, stopped=false;
const status=(text,error=false)=>{$('status').textContent=text;$('status').className=error?'error':'';};
function controls(){
  for(const id of ['add','loaded','select-all','select-none','remove'])$(id).disabled=running;
  $('download').disabled=running||!selected.size;
  $('schedule').disabled=running||selected.size!==1;
  $('stop').disabled=!running||stopped;
}
function render(){
  $('queue').replaceChildren();$('queue-count').textContent=`${links.length} posts`;$('empty').hidden=!!links.length;
  for(const [index,url] of links.entries()){
    const li=document.createElement('li'), checkbox=document.createElement('input');
    checkbox.type='checkbox';checkbox.checked=selected.has(url);checkbox.disabled=running;checkbox.setAttribute('aria-label',`Select post ${index+1}`);
    checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(url):selected.delete(url);controls();});
    const body=document.createElement('div'), a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=url;
    const line=document.createElement('p'); const item=results.get(url);
    line.textContent=item?.text||'Ready';line.className=item?.error?'error':item?.state==='complete'?'success':'';
    body.append(a,line);li.append(checkbox,body);$('queue').append(li);
  }controls();
}
async function add(values){
  const requested=new Set(parseLinks(values.join('\n')).valid.map(url=>new URL(url).pathname.split('/').filter(Boolean).at(-1)));
  links=await changeQueue('add',values);
  for(const url of links)if(requested.has(new URL(url).pathname.split('/').filter(Boolean).at(-1)))selected.add(url);
  selected=new Set([...selected].filter(url=>links.includes(url)));render();
}
$('add').addEventListener('click',async()=>{
  try{const parsed=parseLinks($('links').value);if(parsed.invalid.length)throw new Error(`No links were added. Use individual Instagram post links. Invalid: ${parsed.invalid.slice(0,3).join(', ')}`);
    await add(parsed.valid);$('links').value='';status(`${links.length} posts in the queue.`);
  }catch(error){status(error.message,true);}
});
$('loaded').addEventListener('click',async()=>{
  try{if(!Number.isInteger(tabId)||tabId<=0)throw new Error('Open SWOOP from your Instagram tab first.');
    const response=await chrome.tabs.sendMessage(tabId,{type:'SWOOP_LIST_POSTS'});
    if(!response?.ok)throw new Error(response?.error||'Refresh Instagram after reloading SWOOP, then try again.');
    await add(response.urls);status(`Added loaded posts. ${links.length} total. Scroll Instagram to load more and add again.`);
  }catch(error){status(error.message,true);}
});
$('select-all').addEventListener('click',()=>{selected=new Set(links);render();});
$('select-none').addEventListener('click',()=>{selected.clear();render();});
$('remove').addEventListener('click',async()=>{try{links=await changeQueue('remove',[...selected]);selected.clear();render();status('Selected links removed from the queue.');}catch(error){status(error.message,true);}});
$('stop').addEventListener('click',()=>{stopped=true;controls();status('Stopping after the current post finishes.');});
$('schedule').addEventListener('click',()=>chrome.tabs.create({url:chrome.runtime.getURL(`schedule.html?${new URLSearchParams({tab:String(tabId),post:[...selected][0]})}`)}));
$('download').addEventListener('click',async()=>{
  if(running||!selected.size)return;
  running=true;stopped=false;render();const batch=links.filter(url=>selected.has(url));
  try{
    if(!Number.isInteger(tabId)||tabId<=0)throw new Error('Open this page from an Instagram tab so SWOOP can read the selected posts.');
    const finished=await runBatch(batch,{
      shouldStop:()=>stopped,
      collect:async url=>{const [result]=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:collectPost,args:[url]});if(!result?.result?.ok)throw new Error(result?.result?.error||'No post data returned.');return result.result.post;},
      download:downloadBundle,
      onUpdate:item=>{
        const who=item.post?`@${item.post.username} · `:'';
        const text=item.state==='reading'?'Reading post…':item.state==='downloading'?`${who}Downloading${item.progress?` ${item.progress.index}/${item.progress.total}`:'…'}`:item.state==='complete'?`${who}Saved all ${item.total} media files, caption, and metadata.
Downloads/${item.folder}`:item.state==='partial'?`${who}Incomplete: ${item.saved}/${item.total} media files saved. Caption and metadata saved.`:item.error;
        results.set(item.url,{...item,text,error:item.state==='failed'||item.state==='partial'});render();status(`Post ${item.index+1} of ${batch.length}: ${text}`,item.state==='failed'||item.state==='partial');
      }
    });
    const complete=finished.filter(x=>x.state==='complete').length;
    status(`${complete}/${batch.length} posts saved completely. ${finished.filter(x=>x.state!=='complete').length} incomplete or failed; ${batch.length-finished.length} not attempted.`,complete!==batch.length);
  }catch(error){status(error.message,true);}finally{
    running=false;
    try{const stored=await chrome.storage.local.get(QUEUE_KEY);const next=mergeLinks([],stored[QUEUE_KEY]||[]);for(const url of next)if(!links.includes(url))selected.add(url);links=next;selected=new Set([...selected].filter(url=>links.includes(url)));}catch(error){status(`Queue refresh failed: ${error.message}`,true);}
    render();
  }
});
window.addEventListener('beforeunload',event=>{if(running){event.preventDefault();event.returnValue='';}});
try{const stored=await chrome.storage.local.get(QUEUE_KEY);links=mergeLinks([],stored[QUEUE_KEY]||[]);selected=new Set(links);if(params.get('post'))await add([params.get('post')]);render();}catch(error){status(error.message,true);}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[QUEUE_KEY] || running) return;
  const next=changes[QUEUE_KEY].newValue||[];
  for(const url of next)if(!links.includes(url))selected.add(url);
  links=next;selected=new Set([...selected].filter(url=>links.includes(url)));render();
});
