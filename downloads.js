import {bundlePlan,waitForDownload} from './files.js';
export async function saveText(text, filename, mime, api = chrome.downloads) {
  const url = URL.createObjectURL(new Blob([text], {type:mime}));
  try {
    const id = await api.download({url,filename,saveAs:false,conflictAction:'uniquify'});
    const start = Date.now();
    while (Date.now()-start < 300000) {
      const [item] = await api.search({id});
      if (item?.state === 'complete') return;
      if (!item || item.state === 'interrupted') throw new Error(item?.error || 'Caption or metadata download interrupted.');
      await new Promise(r=>setTimeout(r,500));
    }
    throw new Error('Caption or metadata download is still pending. Check Chrome Downloads.');
  } finally {URL.revokeObjectURL(url);}
}
export async function downloadBundle(post, onProgress = () => {}, api = chrome.downloads) {
  const plan = bundlePlan(post), receipt = [];
  let failures = 0;
  await saveText(plan.captionText,plan.captionFilename,'text/plain;charset=utf-8',api);
  for (const item of plan.media) {
    onProgress({index:item.index,total:plan.media.length});
    let downloadId;
    try {
      downloadId = await api.download({url:item.url,filename:item.filename,saveAs:false,conflictAction:'uniquify'});
      const file = await waitForDownload(api,downloadId);
      receipt.push({index:item.index,download_id:downloadId,filename:file.filename,status:'complete',bytes:file.fileSize});
    } catch (error) {
      failures++; receipt.push({index:item.index,download_id:downloadId??null,filename:item.filename,status:'failed_or_pending',error:error.message});
    }
  }
  const metadata = {...post,download_attempt_finished_at:new Date().toISOString(),download_status:failures?'partial':'complete',downloads:receipt};
  await saveText(JSON.stringify(metadata,null,2)+'\n',plan.metadataFilename,'application/json;charset=utf-8',api);
  return {state:failures?'partial':'complete',folder:plan.folder,saved:receipt.length-failures,total:receipt.length,receipt};
}
