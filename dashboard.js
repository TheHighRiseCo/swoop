import {collectPost} from './collector.js';
import {addToQueue} from './queue.js';
import {bundlePlan, waitForDownload} from './files.js';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const tabId = Number(params.get('tab'));
const targetURL = params.get('post') || undefined;
let post;
let busy = false;
const status = (text, error = false) => { $('status').textContent = text; $('status').className = error ? 'error' : ''; };
function lock(value) {busy = value; $('scan').disabled = value; $('save').disabled = value || !post; for(const id of ['add-bulk','open-schedule'])if($(id))$(id).disabled=value||!post; if($('open-bulk'))$('open-bulk').disabled=value;}
function render() {
  $('post').hidden = false;
  $('username').textContent = `@${post.username}`;
  $('count').textContent = `${post.media_count} ${post.media_count === 1 ? 'item' : 'items'}`;
  $('post-link').href = post.post_url;
  $('caption').textContent = post.caption || 'This post has no caption.';
  $('media').replaceChildren();
  for (const item of post.media) {
    const li = document.createElement('li');
    if (item.type === 'image') {
      const img = document.createElement('img'); img.src = item.url; img.alt = `Carousel item ${item.index}`; img.referrerPolicy = 'no-referrer'; li.append(img);
    } else {
      const icon = document.createElement('div'); icon.className = 'video-placeholder'; icon.textContent = '▶'; icon.setAttribute('aria-label', 'Video'); li.append(icon);
    }
    const details = document.createElement('div'); details.className = 'details';
    const label = document.createElement('div'); label.textContent = `${String(item.index).padStart(2,'0')} · ${item.type}${item.width && item.height ? ` · ${item.width} × ${item.height}` : ''}`;
    const result = document.createElement('div'); result.className = 'result'; result.id = `result-${item.index}`; result.textContent = 'Ready';
    details.append(label, result); li.append(details); $('media').append(li);
  }
  const plan = bundlePlan(post);
  $('folder').textContent = `Saves to Downloads/Instagram/${post.username}/${post.shortcode}_<capture time>/ · ${plan.captionFilename.split('/').at(-1)} + ${plan.metadataFilename.split('/').at(-1)}`;
}
async function scan() {
  lock(true); post = undefined; $('post').hidden = true;
  status('Reading the open Instagram post…');
  try {
    if (!Number.isInteger(tabId) || tabId <= 0) throw new Error('Open an Instagram post and launch this page using the extension icon.');
    const [result] = await chrome.scripting.executeScript({target: {tabId}, world: 'MAIN', func: collectPost, args: [targetURL || null]});
    if (!result?.result?.ok) throw new Error(result?.result?.error || 'No post data was returned. Reload Instagram and try again.');
    post = result.result.post; render();
    status(`Found ${post.media_count} media ${post.media_count === 1 ? 'item' : 'items'}. Review the username and caption, then download.`);
  } catch (error) {status(error.message, true);} finally {lock(false);}
}
async function saveText(text, filename, mime) {
  const url = URL.createObjectURL(new Blob([text], {type:mime}));
  try {
    const id = await chrome.downloads.download({url, filename, saveAs:false, conflictAction:'uniquify'});
    // Metadata is intentionally text/json, so use a dedicated state check.
    const start = Date.now();
    while (Date.now() - start < 300000) {
      const [item] = await chrome.downloads.search({id});
      if (item?.state === 'complete') return;
      if (!item || item.state === 'interrupted') throw new Error(item?.error || 'Metadata download interrupted.');
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    throw new Error('Metadata download is still pending. Check Chrome Downloads.');
  } finally {URL.revokeObjectURL(url);}
}
async function save() {
  if (!post || busy) return;
  lock(true);
  const plan = bundlePlan(post);
  const receipt = [];
  let failures = 0;
  try {
    // Preserve caption even when a later CDN download fails.
    await saveText(plan.captionText, plan.captionFilename, 'text/plain;charset=utf-8');
    for (const item of plan.media) {
      const line = $(`result-${item.index}`); line.textContent = 'Downloading…'; line.className = 'result';
      status(`Downloading item ${item.index} of ${plan.media.length}… Keep this tab open.`);
      let downloadId;
      try {
        downloadId = await chrome.downloads.download({url:item.url, filename:item.filename, saveAs:false, conflictAction:'uniquify'});
        const completed = await waitForDownload(chrome.downloads, downloadId);
        receipt.push({index:item.index, download_id:downloadId, filename:completed.filename, status:'complete', bytes:completed.fileSize});
        line.textContent = 'Saved';
      } catch (error) {
        failures++; receipt.push({index:item.index, download_id:downloadId ?? null, filename:item.filename, status:'failed_or_pending', error:error.message});
        line.textContent = error.message; line.className = 'result error';
      }
    }
    const metadata = {...post, download_attempt_finished_at:new Date().toISOString(), download_status: failures ? 'partial' : 'complete', downloads:receipt};
    await saveText(JSON.stringify(metadata,null,2)+'\n',plan.metadataFilename,'application/json;charset=utf-8');
    $('folder').textContent = `Downloads/${plan.folder}/`;
    status(failures ? `${receipt.length-failures}/${receipt.length} media files saved. Caption and metadata saved; ${failures} failed or pending. Check Chrome Downloads, then reload the post before retrying.`
      : `Saved all ${receipt.length} media files with caption and metadata.`, !!failures);
  } catch (error) {status(`Bundle incomplete: ${error.message} Check Chrome Downloads for files already saved.`,true);}
  finally {lock(false);}
}
$('scan').addEventListener('click',scan);
$('save').addEventListener('click',save);
$('cancel')?.addEventListener('click', () => {if (!busy) window.close();});
window.addEventListener('beforeunload', event => {if(busy){event.preventDefault();event.returnValue='';}});
if (globalThis.chrome?.scripting) scan();
else { $('scan').disabled = true; status('Install this folder as a Chrome extension, then launch it from an Instagram post.'); }

const workspace = (page, url) => chrome.tabs.create({url:chrome.runtime.getURL(`${page}?${new URLSearchParams({tab:String(tabId),...(url?{post:url}:{})})}`)});
$('open-bulk')?.addEventListener('click', () => {if(!busy)workspace('bulk.html');});
$('open-schedule')?.addEventListener('click', () => {if(post&&!busy)workspace('schedule.html',post.post_url);});
$('add-bulk')?.addEventListener('click', async () => {
  if(!post||busy)return;lock(true);
  try{const count=await addToQueue(post.post_url);status(`Added to bulk queue. ${count} posts ready. Click Bulk downloads to select and save them.`);}
  catch(error){status(error.message,true);}finally{lock(false);}
});
