// Self-contained: Chrome serializes this function into the selected page.
// Read page-owned structured post data; never collect comments or account cookies.
export async function collectPost(targetURL) {
  try {
    const target = new URL(targetURL || location.pathname, `https://${location.hostname}`);
    const match = target.pathname.match(/^\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)\/?$/);
    if (!['instagram.com', 'www.instagram.com'].includes(location.hostname)
      || !['instagram.com', 'www.instagram.com'].includes(target.hostname)
      || target.protocol !== 'https:' || target.port || target.username || target.password || !match) {
      throw new Error('Open an individual Instagram photo, Reel, video or carousel first.');
    }
    const shortcode = match[2];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const id = [...shortcode].reduce((n, c) => n * 64n + BigInt(alphabet.indexOf(c)), 0n).toString();
    const isTarget = (o) => (o.code === shortcode || o.shortcode === shortcode || String(o.pk ?? o.id ?? '').split('_')[0] === id)
      && !!(o.image_versions2 || o.display_url || o.carousel_media || o.edge_sidecar_to_children || o.video_versions || o.video_url);
    const candidates = [];
    const visit = (root) => {
      const stack = [root];
      let visited = 0;
      while (stack.length && visited++ < 150000) {
        const value = stack.pop();
        if (!value || typeof value !== 'object') continue;
        if (!Array.isArray(value) && isTarget(value)) candidates.push(value);
        for (const child of Object.values(value)) if (child && typeof child === 'object') stack.push(child);
      }
    };
    for (const script of document.querySelectorAll('script[type="application/json"]')) {
      if (script.textContent.length > 12000000 || !script.textContent.includes(shortcode)) continue;
      try { visit(JSON.parse(script.textContent)); } catch { /* Non-JSON scripts are ignored. */ }
    }
    const safeURL = (url) => {
      try {
        const u = new URL(url);
        return u.protocol === 'https:' && ['cdninstagram.com', 'fbcdn.net'].some(domain => u.hostname === domain || u.hostname.endsWith('.' + domain)) ? u.href : null;
      } catch { return null; }
    };
    const best = (versions = []) => versions.filter(v => safeURL(v.url || v.src))
      .sort((a, b) => (Number(b.width || b.config_width || 0) * Number(b.height || b.config_height || 0))
        - (Number(a.width || a.config_width || 0) * Number(a.height || a.config_height || 0)))[0];
    const normalize = (post, source) => {
      const username = post.user?.username || post.owner?.username;
      if (!username || !/^[A-Za-z0-9_.]{1,30}$/.test(username)) throw new Error('Instagram did not provide the post account username.');
      let caption;
      if (Object.hasOwn(post, 'caption')) {
        if (post.caption === null) caption = '';
        else if (typeof post.caption?.text === 'string') caption = post.caption.text;
        else throw new Error('The full caption could not be verified.');
      } else if (Array.isArray(post.edge_media_to_caption?.edges)) {
        if (post.edge_media_to_caption.edges.some(e => typeof e.node?.text !== 'string')) throw new Error('The full caption could not be verified.');
        caption = post.edge_media_to_caption.edges.map(e => e.node.text).join('\n');
      } else throw new Error('The full caption is unavailable. Reload the post and try again.');
      const carousel = post.carousel_media || post.edge_sidecar_to_children?.edges?.map(e => e.node);
      const isCarousel = post.media_type === 8 || post.__typename === 'GraphSidecar' || !!carousel;
      if (isCarousel && (!Array.isArray(carousel) || !carousel.length)) throw new Error('Carousel data is incomplete. Reload the post first.');
      const expected = Number(post.carousel_media_count || carousel?.length || 1);
      const children = isCarousel ? carousel : [post];
      if (children.length !== expected) throw new Error(`Only ${children.length} of ${expected} carousel items are available. Reload the post first.`);
      const media = children.map((item, index) => {
        const video = item.media_type === 2 || item.is_video === true || !!item.video_url || !!item.video_versions?.length;
        const version = video ? best(item.video_versions) : best(item.image_versions2?.candidates || item.display_resources);
        const url = safeURL(version?.url || version?.src || (video ? item.video_url : item.display_url));
        if (!url) throw new Error(`Item ${index + 1} has no downloadable ${video ? 'video' : 'image'} URL. It will not be replaced with a thumbnail.`);
        const path = new URL(url).pathname;
        const ext = video ? 'mp4' : (path.match(/\.(jpg|jpeg|png|webp|avif)$/i)?.[1]?.toLowerCase() || 'jpg');
        return {index: index + 1, id: String(item.pk || item.id || ''), type: video ? 'video' : 'image',
          url, extension: ext, width: version?.width || version?.config_width || item.original_width || item.dimensions?.width || null,
          height: version?.height || version?.config_height || item.original_height || item.dimensions?.height || null,
          accessibility_caption: item.accessibility_caption || null};
      });
      const timestamp = post.taken_at || post.taken_at_timestamp;
      return {schema_version: 1, username, caption, shortcode, post_url: `https://www.instagram.com/${match[1] === 'reels' ? 'reel' : match[1]}/${shortcode}/`,
        post_id: String(post.pk || post.id || id), posted_at: timestamp ? new Date(Number(timestamp) * 1000).toISOString() : null,
        captured_at: new Date().toISOString(), source, media_count: media.length, media};
    };
    // Prefer the most complete matching object, never neighboring/recommended posts.
    candidates.sort((a, b) => (b.carousel_media?.length || b.edge_sidecar_to_children?.edges?.length || 1)
      - (a.carousel_media?.length || a.edge_sidecar_to_children?.edges?.length || 1));
    for (const post of candidates) {
      try { return {ok: true, post: normalize(post, 'page_json')}; } catch { /* Try the next matching record, then one read-only request. */ }
    }
    // Instagram's internal endpoint is a best-effort fallback and may change.
    const response = await fetch(`/api/v1/media/${id}/info/`, {credentials: 'same-origin',
      headers: {'X-IG-App-ID': '936619743392459'}, signal: AbortSignal.timeout(15000)});
    if (!response.ok) {
      const reason = response.status === 429 ? 'Instagram rate limited the request. Wait before trying again.'
        : [401, 403].includes(response.status) ? 'Instagram requires a logged-in session or has blocked access. Open the post normally and reload it.'
        : `Instagram returned HTTP ${response.status}.`;
      throw new Error(reason);
    }
    const data = await response.json();
    const post = data.items?.find(isTarget);
    if (!post) throw new Error('Instagram did not return this post. It may be unavailable or require a login.');
    return {ok: true, post: normalize(post, 'instagram_media_info')};
  } catch (error) {
    return {ok: false, error: error.name === 'TimeoutError' ? 'Instagram took too long to respond. Try again later.' : error.message};
  }
}
