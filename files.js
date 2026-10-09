export function safeSegment(value) {
  const result = String(value).replace(/[^A-Za-z0-9_.-]/g, '_').replace(/^\.+/, '').slice(0,80);
  return result || 'post';
}
export function bundlePlan(post, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const folder = `Instagram/${safeSegment(post.username)}/${safeSegment(post.shortcode)}_${stamp}`;
  const prefix = `${safeSegment(post.username)}_${safeSegment(post.shortcode)}`;
  const media = post.media.map(item => ({...item, filename: `${folder}/${prefix}_${String(item.index).padStart(2,'0')}_${item.type}.${item.extension}`}));
  const captionText = `@${post.username}\n${post.post_url}\n\n${post.caption}\n`;
  return {folder, media, captionText, captionFilename: `${folder}/${prefix}_caption.txt`, metadataFilename: `${folder}/${prefix}_metadata.json`};
}
export async function waitForDownload(api, id, options = {}) {
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const timeout = options.timeout || 300000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const [item] = await api.search({id});
    if (!item) throw new Error('The download is missing from Chrome download history.');
    if (item.state === 'complete') {
      if (item.mime === 'text/html' || item.mime === 'application/json') throw new Error('Instagram returned an error page instead of media.');
      return item;
    }
    if (item.state === 'interrupted') throw new Error(item.error || 'Download interrupted.');
    await sleep(500);
  }
  throw new Error('Download is still pending after five minutes. Check Chrome Downloads.');
}
