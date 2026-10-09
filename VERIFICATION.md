# Verification — October 8, 2026 (America/Los_Angeles)

## Passed

- All 16 dependency-free Node tests passed after the final code change. Tests cover exact-post matching, image resolution selection, full Unicode captions, no-caption videos, mixed carousel ordering, account-prefixed URLs, legacy GraphQL data, missing video URLs, incomplete carousels, unavailable captions/usernames, trusted CDN validation, lossless shortcode IDs, API errors, and download completion/interruption.
- Dashboard integration tests exercise the shipped module with a mocked Chrome API. They verify a complete bundle, partial media failure with accurate metadata, preserved caption text, and metadata failure preventing a success claim.
- JavaScript syntax checks passed for the background worker, collector, dashboard, and file helpers.
- The shipped self-contained collector function was loaded from the deliverable and executed in the real Instagram page through the tab's developer protocol. It extracted a five-image carousel from `https://www.instagram.com/p/DUqvTdAjOKw/` and a single-video Reel from `https://www.instagram.com/luvalicetattoo/reel/Db3euARsjBA/`. Both used `page_json`, captured `luvalicetattoo`, and included the full caption. The test pages were accessible through the existing Chrome session.
- All five extracted carousel URLs and the video URL were retrieved directly from Instagram's CDN into local scratch files. Image downloads had JPEG MIME types and signatures. macOS image decoding confirmed four images at 1440 × 1800 and one at 736 × 920. File sizes were 241692, 191781, 185931, 175439, and 76036 bytes.
- The downloaded video had MP4 MIME type and signature and was 1577701 bytes. Chrome decoded it at 720 × 1280 with duration 11.165941 seconds, reported no media error, and played it successfully. The local `ffprobe` binary could not run because of an incompatible CPU architecture; Chrome's actual media decode/playback check supplied the runtime verification instead.
- The actual dashboard HTML/CSS/JS was rendered in Chrome using captured live carousel data and a mocked extraction API. The complete caption and all five previews were visible. A development-preview screenshot is supplied separately as `instagram-saver-preview.png`. This screenshot is a UI preview, not evidence of an installed-extension download.
- The dashboard displayed an incomplete-bundle error when the development preview's download API deliberately rejected the request.

## Still unverified

- This was the status at the original development pass. A subsequent installed-extension pass is recorded in `INSTALLATION-VERIFICATION.md`; it observed toolbar launch, five-image carousel extraction, and the dashboard's successful-download status, but did not independently locate the saved bytes. The new 1.1.0 overlay activation remains unverified pending reload/site access and an Instagram refresh.
- Live extraction used page JSON. The internal `/api/v1/media/.../info/` fallback was checked against the current gallery-dl source and tested with fixtures, but was not exercised against Instagram live.
- Live samples covered an image carousel and a video Reel. Mixed video/image carousels and single-image posts were covered by fixtures rather than additional live samples.
- Private/inaccessible/deleted posts, Stories, bulk profile downloads, localized error messages, and enterprise browser download restrictions were not live-tested. Stories and bulk profile downloads are outside the implemented scope.

Instagram can change its page data and internal endpoints. Signed media URLs expire. These checks demonstrate the observed extraction and media retrieval, not compatibility with every account or future Instagram version.
