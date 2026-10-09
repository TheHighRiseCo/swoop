if(typeof importScripts==='function')importScripts('reminders-worker.js');
// Queue writes go through one worker so two open prompts cannot overwrite each other.
let queueWrites = Promise.resolve();
function mutateQueue(message, sender, respond) {
  const work = queueWrites.then(async () => {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')) || sender.frameId !== 0) throw new Error('Only SWOOP pages can change the queue.');
    const stored = await chrome.storage.local.get('swoop.bulk.v1');
    const previous = stored['swoop.bulk.v1'] || [];
    if (!Array.isArray(message.urls) || message.urls.some(value => typeof value !== 'string')) throw new Error('Invalid queue request.');
    const removed = new Set(message.urls);
    const values = message.action === 'add' ? [...previous,...message.urls] : message.action === 'remove' ? previous.filter(url => !removed.has(url)) : null;
    if (!values) throw new Error('Unknown queue action.');
    const seen = new Set(), urls = [];
    for (const value of values) {
      const u = new URL(value), match = u.pathname.match(/^\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)\/?$/);
      if (u.protocol !== 'https:' || !['www.instagram.com','instagram.com'].includes(u.hostname) || u.port || u.username || u.password || !match) throw new Error('Use individual Instagram post links.');
      if (!seen.has(match[2])) {seen.add(match[2]); urls.push(`https://www.instagram.com/${match[1]==='reels'?'reel':match[1]}/${match[2]}/`);}
    }
    if (urls.length > 100) throw new Error('Choose up to 100 posts per batch.');
    await chrome.storage.local.set({'swoop.bulk.v1':urls});
    return {ok: true, urls};
  });
  queueWrites = work.catch(() => {});
  work.then(respond, error => respond({ok: false, error: error.message}));
  return true;
}
chrome.storage?.local?.setAccessLevel?.({accessLevel:'TRUSTED_CONTEXTS'}).catch(() => {});
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({url: chrome.runtime.getURL(`dashboard.html?tab=${tab.id}`)});
});

// Only our Instagram content script may open a prompt for its own tab.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if(message?.type==='SWOOP_LOCAL_REMINDER')return globalThis.SwoopReminders.handle(message,sender,respond);
  if (message?.type === 'SWOOP_QUEUE_CHANGE') return mutateQueue(message, sender, respond);
  if (message?.type !== 'SWOOP_OPEN_POST') return false;
  try {
    const page = new URL(sender.url || '');
    const post = new URL(message.url);
    const hosts = ['instagram.com', 'www.instagram.com'];
    if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id)
      || page.protocol !== 'https:' || !hosts.includes(page.hostname) || page.port
      || post.protocol !== 'https:' || !hosts.includes(post.hostname) || post.port || post.username || post.password
      || !/^\/(?:[A-Za-z0-9_.]+\/)?(?:p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?$/.test(post.pathname)) {
      throw new Error('SWOOP could not verify this Instagram post. Open the individual post and try again.');
    }
    const params = new URLSearchParams({tab: String(sender.tab.id), post: post.origin + post.pathname});
    chrome.windows.create({url: chrome.runtime.getURL(`prompt.html?${params}`), type: 'popup', width: 520, height: 740, focused: true})
      .then(() => respond({ok: true}), error => respond({ok: false, error: error.message}));
    return true;
  } catch (error) {
    respond({ok: false, error: error.message});
    return false;
  }
});
