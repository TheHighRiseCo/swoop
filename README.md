# SWOOP — Instagram Post Saver

SWOOP 1.3.0 saves Instagram photos, videos, Reels, and complete carousels with the account username and caption, individually or in a selected batch. It schedules selected media and an editable caption through Zernio or Postiz to connected Instagram, LinkedIn, and X accounts, or saves a local kit with manual posting reminders. Downloading and local reminder mode need no API key or backend. Automatic publication requires your chosen provider account/API key, supported destination accounts, and any provider plan required for API access. Chrome 120 or newer is required.

## Get it from GitHub

This repository contains the standard SWOOP v1 Chrome extension, currently **1.3.0**.

- Clone the repository, or select **Code > Download ZIP** on GitHub and extract it.
- In Chrome, open Extensions, enable Developer mode, choose **Load unpacked**, and select the extracted repository folder containing `manifest.json`.
- The runtime has no dependency installation or build step. For local checks, use Node.js and run `npm test` from this folder.

## Install a packaged download

1. Extract `SWOOP-extension.zip` if you downloaded the ZIP. Keep the extracted folder in a permanent location.
2. Open `chrome://extensions` in Chrome and switch **Developer mode** on.
3. Click **Load unpacked**, then select the `SWOOP-extension` folder containing `manifest.json`.
4. Pin **SWOOP — Instagram Post Saver** using Chrome's Extensions menu if you want easy access.

These are Chrome's official [unpacked-extension installation steps](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## Update an existing installation

Version 1.3.0 adds Zernio/Postiz choices and local posting reminders while keeping the purple post button and account-based filenames. Click **Reload** for SWOOP in Chrome’s Extensions page, review any Chrome permission prompt, and refresh open Instagram tabs. Close old SWOOP prompts before reopening them. Keep the source folder in place. This update uses local storage and Chrome alarms; notifications and scheduler/upload site access are optional and requested only when you connect or confirm a schedule.

## Use

1. Browse Instagram normally in Chrome. Log in normally if Instagram requires it.
2. Click the small purple SWOOP logo at the upper-left of a post’s photo or video. A compact download prompt opens for that specific post. Buttons also appear on identifiable profile/explore grid items and newly loaded posts.
3. Check the account, full caption, media count, and item order.
4. Click **Download post** and leave the prompt open until it finishes. A carousel saves every available item in order, rather than just the displayed slide.

The toolbar icon still opens the full preview for an individual post. Stories and automatic whole-account archives remain outside this version’s scope. If an Instagram layout does not expose a usable post link or ID, open the post individually and use the toolbar icon.

Every run creates a new folder under your Chrome Downloads location:

```text
Instagram/
  account.username/
    POSTCODE_capture-time/
      account.username_POSTCODE_01_image.jpg
      account.username_POSTCODE_02_video.mp4
      ...
      account.username_POSTCODE_caption.txt
      account.username_POSTCODE_metadata.json
```

All downloaded filenames start with the account username and post code, so the account stays identifiable even if files are moved out of their folder. Media filenames also preserve carousel order. This applies to new downloads; existing files are unchanged. `caption.txt` includes the username, post link, and exact caption with line breaks and Unicode. `metadata.json` includes the username, caption, post URL, available timestamp, media dimensions, signed source URLs, and per-file download results. Media is saved at the highest resolution exposed in the post's downloadable image/MP4 variants; that does not necessarily equal the uploaded original.

The extension waits for Chrome to report completed downloads. Missing items, interrupted transfers, and metadata failures produce a partial/incomplete status. A missing video is never silently replaced by its thumbnail. A confirmed absent caption is represented as an empty string. An unavailable caption or username blocks extraction.

## Bulk downloads

1. Open SWOOP from an Instagram tab. In the post prompt or full preview, choose **Add to bulk queue** or **Bulk downloads**.
2. Paste individual post/Reel links and click **Add links**, or click **Add posts loaded on Instagram** to add identifiable posts already loaded in that tab. Scroll Instagram first to load more posts, then add again.
3. Select up to 100 posts and click **Download selected**. Leave the bulk tab open. Each post keeps its own account-named folder, complete available carousel, caption, and metadata.
4. Check each result. **Stop after current post** finishes that post before stopping. Rate limits stop the batch. Failed or partial posts stay visible and can be selected again later; retrying creates a new capture folder.

The queue persists locally between visits. It deduplicates post links, including the same shortcode shared as a post/Reel link. This is selected-post batching, not a background crawler or automatic entire-profile archive.

## Scheduling options

Open **Schedule this post** from a SWOOP preview, or select exactly one post in Bulk downloads and click **Schedule selected post**. Choose a method in **Scheduling method**. The three options share the caption editor, media selection, date/time/timezone, and review step.

### Zernio — automatic publishing

1. Select **Zernio**. Enter your Zernio API key and click **Connect / refresh accounts**; review Chrome's optional site-access prompt.
2. Explicitly select the connected destination accounts and the media to publish. Connect missing Instagram, LinkedIn, or X accounts in Zernio and refresh.
3. Set a time at least two minutes ahead and the IANA timezone. Click **Review schedule**, check the details, then **Confirm and schedule**.
4. Keep the tab open through upload, submission, and verification. Zernio handles future publication after the request is saved.

SWOOP does not inherit credentials from Codex or NexusOS. The key stays in Chrome session storage and is cleared on browser close or Disconnect SWOOP.

### Postiz — automatic publishing

1. Select **Postiz**, then choose **Postiz Cloud** or **Existing local Postiz server · port 4007**.
2. Connect your social channels in Postiz first. Enter that Postiz instance's API key in SWOOP and click **Connect / refresh accounts**. Nothing is selected automatically.
3. Edit the caption, choose media, explicitly select the destination channels, and set the time/timezone.
4. Click **Review schedule**, then **Confirm and schedule**. Keep the tab open until the result is verified.

Cloud uses the official `https://api.postiz.com/public/v1` API. Local Postiz uses `http://127.0.0.1:4007/api/public/v1`; an existing server with that configuration must already be running. SWOOP does not install or host Postiz, register developer apps, or connect its social accounts for you. Other self-hosted endpoints and custom storage domains are not included in this version. Cloud upload URLs must use `uploads.postiz.com`; local upload URLs can also use that local Postiz origin.

Media is uploaded as files to the selected Postiz instance before creating the scheduled post. Supported destinations here include Instagram FB-linked/Standalone, LinkedIn profiles/pages, and X. Readback checks all returned post IDs, channel/provider identities, scheduled time, caption, and queued state. It does not prove eventual publication or independently inspect the stored media bytes.

Postiz requests with uncertain results are not resent, since this integration has no verified provider idempotency guarantee. Use **Check status** when IDs were returned; otherwise inspect the Postiz dashboard. Resolve an uncertain local receipt only after checking/resolving the original submission in the provider. That action does not cancel any provider post.

### Local — posting kit and manual reminder

1. Select **Local · files + manual posting reminder**. No API key or provider account is needed.
2. Edit the caption, select the media, and choose the platforms you plan to post to manually. Set the reminder time/timezone.
3. Optionally leave **Also request a Chrome notification** checked. Chrome will ask for notification access when you confirm. If declined, the kit/calendar/reminder list still work without notifications.
4. Click **Review schedule**, then **Save posting kit and reminder**. Leave the tab open while saving.
5. Your account-named folder contains the selected media, edited caption, metadata, and a `_posting-reminder.ics` calendar file. Import the .ics file into your calendar app for a separate reminder.
6. Use **Open local reminders** to view the saved caption/folder, re-export a calendar file, or cancel the Chrome reminder. Publish manually in the platform's own interface.

Local mode never automatically uploads or publishes to a social network. It requires completed media/sidecar downloads before creating the calendar/reminder. Up to 100 active Chrome reminders are supported. Reminders persist locally and are restored when the extension/browser starts; overdue jobs are marked Due. Chrome notifications can be delayed when Chrome is closed, the computer sleeps, or OS notifications are blocked. SWOOP cancellation does not cancel an event already imported into a calendar app.

### Common scheduling behavior

Times must be at least two minutes ahead throughout preparation/submission. Ambiguous/nonexistent daylight-saving times are rejected. Automatic methods upload media first to avoid expiring Instagram URLs as future publishing sources. One provider is used per submission; there is no automatic cross-provider fallback.

Automatic publishing supports up to 10 Instagram items; LinkedIn up to 20 images or one video; X up to four images or one video. LinkedIn/X mixed-media selections are blocked. Caption limits are checked. Uploads here support JPEG/PNG images up to 8 MB and MP4 videos up to 250 MB; platform-specific duration, dimensions, codecs, permissions, quotas, and account restrictions can still fail at the provider.

Recent schedules are local receipts, not live publication monitoring. Check/cancel actual schedules in the chosen provider dashboard. Disconnecting SWOOP does not cancel existing schedules. Zernio retains an immutable request/idempotency key for uncertain retries; Postiz never blindly resubmits. Unconfirmed submissions block new automatic schedules for the same source until checked or explicitly resolved locally.

Scheduling remains one reviewed source post at a time. Bulk scheduling, recurring campaigns, and automatic NexusOS synchronization are not included.

## Access and privacy

Required permissions are `activeTab`, `scripting`, `downloads`, `storage`, and `alarms`. Content scripts and mandatory host access remain limited to Instagram's two HTTPS hostnames. Post buttons read links/IDs and media positions without fetching/downloading posts. Extraction uses page data and, if necessary, a read-only same-origin request through your existing Instagram session. SWOOP has no cookie/password API or browsing-history access and does not export cookies.

Bulk links, scheduler choice, schedule receipts, captions, destination labels, provider IDs/media URLs, and local reminder data are stored locally, restricted to trusted extension contexts. Zernio/Postiz API keys stay only in Chrome session storage. No provider key is embedded or stored in local receipts. No analytics or telemetry is included.

Download/local reminder mode sends no caption/media to a scheduler. After confirmation, automatic mode sends the selected caption, media, destinations, and time to the chosen provider. Optional hosts are Zernio, Instagram/Facebook media CDNs, Zernio upload storage, Postiz Cloud, and loopback `127.0.0.1`. Chrome's loopback permission covers that host; runtime Postiz requests are fixed to port 4007. Optional notifications are requested only when the user confirms a local reminder with notifications enabled. No all-sites permission is declared.

Use content you own or have permission to republish. This extension does not establish content rights or guarantee Chrome Web Store approval.

Instagram must already let your session view the post. This extension cannot unlock inaccessible posts. Instagram's page structures and internal read endpoint can change. Signed CDN media URLs also expire, so reload the original post and click **Read open post** if a later download fails.

Chrome's **Ask where to save each file before downloading** setting can prompt for each file. Chrome download permissions or enterprise policies may also affect saving. The extension does not alter browser settings.

## Verification

The accompanying `PROVIDER-OPTIONS-VERIFICATION.md` records the current checks and distinguishes simulated browser verification from installed-extension and real-provider verification. Earlier verification files document previous versions.

For development, Node.js 20+ can run the dependency-free tests:

```sh
npm test
```

No Node installation is needed to use the extension.

Implementation references: [Chrome scripting API](https://developer.chrome.com/docs/extensions/reference/api/scripting), [Chrome downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads), and the current [gallery-dl Instagram extractor](https://github.com/mikf/gallery-dl/blob/master/gallery_dl/extractor/instagram.py), used to verify Instagram's internal media-info endpoint and schema. This extension does not bundle gallery-dl.
