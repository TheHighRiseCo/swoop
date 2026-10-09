# SWOOP 1.1.0 post-button verification — October 9, 2026

## Passed

- All 23 dependency-free Node tests pass. New cases verify a selected feed post rather than a neighboring post, full mixed-carousel order, lossless conversion of Instagram media IDs, canonical Instagram links, and rejection of invalid URLs, frames, origins, and extension identities.
- Chrome rendered the shipped content script on a local sample feed. The small purple/yellow SWOOP logo appeared at the upper-left of media. A trusted click selected the correct post and opened the shipped compact prompt, showing the username, full multiline caption, and three ordered media items.
- Adding a post after page load produced a new button automatically; its click selected the newly added post’s ID.
- The shipped prompt completed the three-media/caption/metadata flow with simulated Chrome APIs. This check proves the local interface and control flow; it does not prove actual Instagram extraction or files saved by Chrome.
- Screenshots are local sample-media previews, not screenshots of the updated extension operating on Instagram.
- JavaScript syntax, manifest resource paths, and both packaged ZIP archives passed their checks.

## Activation and remaining verification

The existing unpacked extension source at `~/Desktop/instagram-saver 2` was updated in place to version 1.1.0. Chrome must reload it, grant Instagram-only site access if prompted, and refresh open Instagram tabs before the automatic buttons can run. Chrome’s internal extension settings are outside the browser tool’s allowed URL scope, so that activation step requires the user.

The new content-script injection, live feed extraction through the internal media-info fallback, real popup creation, and actual download files have not been verified together in the installed 1.1.0 extension. The existing collector/download tests pass; prior live and installed checks are recorded separately in `VERIFICATION.md` and `INSTALLATION-VERIFICATION.md`. Instagram can change its layouts and endpoints. Unknown post IDs produce an explicit message directing the user to open the individual post.
