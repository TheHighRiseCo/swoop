# Instagram Post Saver installation verification

Verified in the current Chrome profile on October 8, 2026 (America/Los_Angeles).

- Instagram Post Saver 1.0.0 is installed and enabled.
- Chrome reports its unpacked source as ~/Desktop/instagram-saver 2.
- The toolbar action is pinned and launches the installed extension dashboard.
- The installed chrome.scripting extraction found all five carousel items, the account username, and the full caption for https://www.instagram.com/p/DUqvTdAjOKw/.
- The real Download post action ran. The installed dashboard reported: Saved all 5 media files, caption.txt, and metadata.json. Each media item displayed Saved.
- The dashboard reported the relative bundle folder: Downloads/Instagram/luvalicetattoo/DUqvTdAjOKw_2026-10-09T06-07-49-035Z/.

The installed Reel download test was interrupted by continued Chrome activity and was not completed. The saved bundle could not be located through the available filesystem checks, so its absolute location and on-disk bytes were not independently verified in this installation pass. No success screenshot was captured before the Chrome window changed. The earlier development pass verified live Reel extraction and MP4 retrieval/decode, as separately described in the extension's original verification document.

Keep the unpacked source folder in place so Chrome can continue loading the extension.
