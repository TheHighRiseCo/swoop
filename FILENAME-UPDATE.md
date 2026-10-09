# SWOOP 1.1.1 — account-based filenames

The unpacked extension source at ~/Desktop/instagram-saver 2 is updated. New downloads prefix every media, caption, and metadata filename with the account username and post code. Carousel items retain their ordered number and media type. Account folders and unique capture folders are retained.

Example: sample.account_Test_01_image.jpg, sample.account_Test_02_video.mp4, sample.account_Test_caption.txt, sample.account_Test_metadata.json.

All 23 Node tests pass. The download integration test checks the actual filename arguments passed by the shipped dashboard module to the mocked Chrome downloads API, including all three carousel items and both sidecars. JavaScript syntax and ZIP integrity checks pass. An installed Chrome download with the new naming has not been performed. Reload SWOOP and reopen its prompt to activate it. No permissions were added in 1.1.1. Existing downloaded files are unchanged.
