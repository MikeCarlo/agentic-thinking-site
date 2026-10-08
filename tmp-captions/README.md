# Temporary captions for AG 043-045

YouTube blocks yt-dlp caption/metadata fetches from cloud VMs, so these were prepared on Mike's PC.

| Folder | YouTube | transcript.en.vtt source | metadata.json source |
|---|---|---|---|
| ep043 | https://www.youtube.com/watch?v=Nw-IrAZp7FQ | LSG AssemblyAI transcript, shifted -6.011s to the YouTube timeline | yt-dlp --dump-single-json (trimmed) |
| ep044 | https://www.youtube.com/watch?v=WXiY2YEpraI | LSG AssemblyAI transcript, shifted -8.594s | yt-dlp --dump-single-json (trimmed) |
| ep045 | https://www.youtube.com/watch?v=4YvZKxlTNco | LSG AssemblyAI transcript, shifted -10.768s | yt-dlp --dump-single-json (trimmed) |

YouTube auto-captions returned HTTP 429 (PO token required) even from the residential IP, so the VTTs are
WebVTT built from AssemblyAI word timings (not YouTube's rolling auto-caption format). Offsets were measured by
cross-correlating the YouTube audio against the master recording. `>>` marks a speaker change.

metadata.json keeps only id, title, description, upload_date, duration, tags, channel fields etc.
(formats / signed stream URLs removed). It is a drop-in for what `fetch_metadata()` returns.

`scripts/create_episode_post.py` has no local-file flag. Options:

1. Stub yt-dlp: put a fake `yt-dlp` first on PATH that prints `metadata.json` for `--dump-single-json` and copies
   `transcript.en.vtt` to `<-o value>.en.vtt` for `--write-auto-sub`.
2. Manual: build the MDX from metadata.json (same as build_mdx), then run
   `python scripts/clean_vtt.py tmp-captions/ep0NN/transcript.en.vtt src/content/episodes/<file>.mdx`.

Delete this folder before merging.
