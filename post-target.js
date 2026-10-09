// Shared by the isolated content script and its tests. No Instagram request occurs here.
(() => {
  const canonical = (value, base) => {
    try {
      const url = new URL(value, base);
      const match = url.pathname.match(/^\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)\/?$/);
      if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname)
        || url.username || url.password || url.port || !match) return null;
      return `https://www.instagram.com/${match[1] === 'reels' ? 'reel' : match[1]}/${match[2]}/`;
    } catch { return null; }
  };
  const fromId = value => {
    const text = String(value || '').split('_')[0];
    if (!/^\d{5,30}$/.test(text)) return null;
    let id = BigInt(text);
    if (id <= 0n) return null;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let shortcode = '';
    while (id > 0n) {shortcode = alphabet[Number(id % 64n)] + shortcode; id /= 64n;}
    return `https://www.instagram.com/p/${shortcode}/`;
  };
  globalThis.SwoopTargets = Object.freeze({canonical, fromId});
})();
