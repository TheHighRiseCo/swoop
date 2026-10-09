(() => {
  if (globalThis.__swoopOverlay) return;
  globalThis.__swoopOverlay = true;
  const {canonical, fromId} = globalThis.SwoopTargets;
  const host = document.createElement('div');
  host.id = 'swoop-post-buttons';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483000;pointer-events:none;';
  const shadow = host.attachShadow({mode: 'open'});
  const style = document.createElement('style');
  style.textContent = `
    :host{all:initial}*{box-sizing:border-box}
    button{position:absolute;pointer-events:auto;width:46px;height:46px;padding:0;border:1px solid #bb76ff;
      border-radius:12px;background:#6200b3;box-shadow:0 3px 12px #0006;cursor:pointer;display:grid;place-items:center;
      transition:transform .15s,box-shadow .15s;overflow:hidden}
    button:hover{transform:translateY(-2px);box-shadow:0 5px 18px #6100b380}
    button:focus-visible{outline:3px solid #f5ff00;outline-offset:3px}
    button:disabled{cursor:wait;opacity:.7}img{width:44px;height:44px;display:block;pointer-events:none}
    .notice{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);max-width:420px;padding:14px 18px;
      border-radius:12px;background:#350062;color:white;font:14px/1.5 system-ui,sans-serif;pointer-events:auto;
      border:1px solid #a05cdb;box-shadow:0 5px 24px #0005}.notice[hidden]{display:none}
  `;
  shadow.append(style);
  const notice = document.createElement('div');
  notice.className = 'notice'; notice.hidden = true; notice.setAttribute('role', 'status');
  shadow.append(notice);
  document.documentElement.append(host);
  const entries = new Map();
  let frame = 0, timer;
  const tell = text => {
    notice.textContent = text; notice.hidden = false;
    clearTimeout(timer); timer = setTimeout(() => {notice.hidden = true;}, 7000);
  };
  const findTarget = card => {
    const outerLink = card.closest('a[href]');
    const links = outerLink ? [outerLink, ...card.querySelectorAll('a[href]')] : [...card.querySelectorAll('a[href]')];
    for (const link of links) {
      const url = canonical(link.getAttribute('href'), location.href);
      if (url) return url;
    }
    for (const name of ['data-post-id', 'data-media-id']) {
      const url = fromId(card.getAttribute(name));
      if (url) return url;
    }
    // The current URL identifies only a single-post view, never a feed or profile.
    return card.matches('article, [role="dialog"], main') ? canonical(location.href) : null;
  };
  const chooseMedia = card => {
    const bounds = card.getBoundingClientRect();
    let best = null, score = -1;
    for (const media of card.querySelectorAll('img,video')) {
      const rect = media.getBoundingClientRect();
      if (rect.width < 140 || rect.height < 140) continue;
      const area = Math.max(0, Math.min(rect.right, bounds.right, innerWidth) - Math.max(rect.left, bounds.left, 0))
        * Math.max(0, Math.min(rect.bottom, bounds.bottom, innerHeight) - Math.max(rect.top, bounds.top, 0));
      if (area > score) {best = media; score = area;}
    }
    return best;
  };
  const add = card => {
    const media = chooseMedia(card);
    if (!media) return;
    const url = findTarget(card);
    let entry = entries.get(card);
    if (!entry) {
      const button = document.createElement('button');
      button.type = 'button'; button.title = 'Download this post with SWOOP';
      button.setAttribute('aria-label', 'Download this post with SWOOP');
      const icon = document.createElement('img');
      icon.src = chrome.runtime.getURL('icons/icon-128.png'); icon.alt = 'SWOOP';
      button.append(icon);
      entry = {button, media, url}; entries.set(card, entry); shadow.append(button);
      button.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        if (!event.isTrusted) return;
        // Re-read the card: Instagram can recycle nodes while scrolling.
        const selected = findTarget(card);
        if (!selected) {tell('SWOOP could not identify this post. Open it individually, then click SWOOP again.'); return;}
        button.disabled = true;
        try {
          const result = await chrome.runtime.sendMessage({type: 'SWOOP_OPEN_POST', url: selected});
          if (!result?.ok) throw new Error(result?.error || 'The download prompt could not open.');
        } catch (error) {
          tell(error.message?.includes('Extension context invalidated')
            ? 'SWOOP was updated. Refresh Instagram to activate the new buttons.' : error.message);
        } finally {button.disabled = false;}
      });
    }
    entry.media = media; entry.url = url;
  };
  const discover = () => {
    const cards = [...document.querySelectorAll('article')];
    for (const card of cards) add(card);
    // Profile/explore grids have post links rather than article elements.
    for (const link of document.querySelectorAll('main a[href]')) {
      if (!link.closest('article') && canonical(link.getAttribute('href'), location.href)) add(link);
    }
    // Reels can expose an ID on a non-article container.
    for (const card of document.querySelectorAll('[data-post-id], [data-media-id]')) {
      if (!card.closest('article') && !card.closest('a[href]')) add(card);
    }
    if (!cards.length && canonical(location.href)) {
      const card = document.querySelector('[role="dialog"]') || document.querySelector('main');
      if (card && ![...entries.keys()].some(node => card.contains(node))) add(card);
    }
  };
  const position = () => {
    const modal = document.querySelector('[role="dialog"]');
    const seen = new Set();
    for (const [card, entry] of entries) {
      if (!card.isConnected || !entry.media.isConnected) {entry.button.remove(); entries.delete(card); continue;}
      const rect = entry.media.getBoundingClientRect();
      const bounds = card.getBoundingClientRect();
      const left = Math.max(rect.left, bounds.left), top = Math.max(rect.top, bounds.top);
      const right = Math.min(rect.right, bounds.right), bottom = Math.min(rect.bottom, bounds.bottom);
      const duplicate = entry.url && seen.has(entry.url);
      const visible = !duplicate && right - left > 100 && bottom - top > 100 && right > 0 && left < innerWidth
        && bottom > 0 && top < innerHeight && (!modal || modal.contains(card) || card.contains(modal));
      entry.button.style.display = visible ? 'grid' : 'none';
      if (!visible) continue;
      if (entry.url) seen.add(entry.url);
      entry.button.style.left = `${Math.max(8, Math.min(left + 12, innerWidth - 58))}px`;
      // Hide after the top of the media scrolls away, instead of covering its caption.
      entry.button.style.top = `${top + 12}px`;
      if (top + 58 < 0) entry.button.style.display = 'none';
    }
  };
  const schedule = () => {
    if (frame || document.hidden) return;
    frame = requestAnimationFrame(() => {frame = 0; discover(); position();});
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {childList: true, subtree: true, attributes: true,
    attributeFilter: ['href', 'src', 'data-post-id', 'data-media-id']});
  addEventListener('scroll', schedule, {capture: true, passive: true});
  addEventListener('resize', schedule, {passive: true});
  addEventListener('popstate', schedule);
  document.addEventListener('visibilitychange', schedule);
  // Catches client-side navigation and recycled video cards without patching Instagram.
  setInterval(schedule, 1500);
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'SWOOP_LIST_POSTS' || sender.id !== chrome.runtime.id) return false;
    discover();
    const urls = [...new Set([...entries.keys()].map(findTarget).filter(Boolean))];
    respond({ok: true, urls});
    return false;
  });
  schedule();
})();
