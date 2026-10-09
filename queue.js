import './post-target.js';
export const MAX_POSTS = 100;
export const QUEUE_KEY = 'swoop.bulk.v1';
export function parseLinks(text) {
  const valid = [], invalid = [], seen = new Set();
  for (const value of String(text).split(/[\s,]+/).filter(Boolean)) {
    const url = globalThis.SwoopTargets.canonical(value);
    if (!url) {invalid.push(value); continue;}
    const key = new URL(url).pathname.split('/').filter(Boolean).at(-1);
    if (!seen.has(key)) {seen.add(key); valid.push(url);}
  }
  if (valid.length > MAX_POSTS) throw new Error(`Choose up to ${MAX_POSTS} posts per batch.`);
  return {valid, invalid};
}
export function mergeLinks(existing, added) {
  const parsed = parseLinks([...existing, ...added].join('\n'));
  if (parsed.invalid.length) throw new Error('The queue contains an invalid Instagram post link.');
  return parsed.valid;
}
export async function changeQueue(action, urls, api = chrome) {
  const result = await api.runtime.sendMessage({type:'SWOOP_QUEUE_CHANGE',action,urls});
  if (!result?.ok) throw new Error(result?.error || 'The download queue could not be saved. Reload SWOOP and refresh Instagram.');
  return result.urls;
}
export async function addToQueue(url, api = chrome) {
  return (await changeQueue('add',[url],api)).length;
}
export async function runBatch(urls, {collect, download, onUpdate = () => {}, shouldStop = () => false, pause = ms => new Promise(r=>setTimeout(r,ms))}) {
  const results = [];
  for (const [index, url] of urls.entries()) {
    if (shouldStop()) break;
    onUpdate({url,index,state:'reading'});
    try {
      const post = await collect(url);
      onUpdate({url,index,state:'downloading',post});
      const result = await download(post, progress => onUpdate({url,index,state:'downloading',post,progress}));
      results.push({url,...result});
      onUpdate({url,index,...result,post});
    } catch (error) {
      const result = {url,state:'failed',error:error.message}; results.push(result); onUpdate({index,...result});
      if (/429|rate.?limit/i.test(error.message)) break;
    }
    if (index < urls.length - 1 && !shouldStop()) await pause(1000);
  }
  return results;
}
