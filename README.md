# VaultStream — Unreleased Lossless Music Tracker Player (Phase 1 PC Prototype)

Lightweight local Node.js + TypeScript proof-of-concept validating:
1. **ArtistGrid Tracker Indexing** (`trackerapi.artistgrid.cx` v3 + `trackerapi-2.artistgrid.cx` v2 fallback + `artists.artistgrid.cx/artists.csv` directory).
2. **SQLite FTS5 Full-Text Search** via Node 24 built-in `node:sqlite` (`unicode61` tokenizer, BM25 ranking, era/host/quality/lossless/cached filters).
3. **Host Link Resolution** modeled on `ArtistGrid/trackerdl` and `ArtistGrid/artistgrid`:
   - Pixeldrain (`/u/<id>` -> `/api/file/<id>` + `/info` metadata)
   - Pillowcase / Pillows (`pillows.su/f/<id>` -> `api.pillows.su/api/download/<id>`)
   - Froste (`music.froste.lol/song/<id>/download`)
   - KrakenFiles, Imgur.gg, SoundCloud (`sc.maid.zone`), Tidal, Qobuz, Google Drive, JuiceWRLD API, and direct lossless URLs
4. **Progressive HTTP Byte-Range Streaming & Smart LRU Disk Cache (`./cache`)**:
   - Supports `206 Partial Content` / `Accept-Ranges: bytes` for immediate lossless playback and instant scrubbing.
   - Caches downloaded byte segments progressively under `./cache/<cacheKey>/`, merges contiguous segments, and parses FLAC `STREAMINFO` / WAV `fmt ` headers (sample rate, bit depth, channels).
   - Enforces a configurable max disk cap (default **2 GB**) via Least Recently Used (LRU) eviction backed by SQLite metadata.

## Requirements
- **Node.js v24+** (uses built-in `node:sqlite` with FTS5 and native TypeScript type stripping)

## Run Locally (Windows `.exe` or CLI)
Double-click **`VaultStream.exe`** (native Windows app launcher + system tray with no console window) or **`start.bat`**, or run manually:
```bash
npm install
npm start
```
Then open **http://127.0.0.1:3456** in your browser.

To rebuild **`VaultStream.exe`** from source (`desktop/VaultStream.cs`):
```bash
npm run build:exe
```

### Automatic GitHub Updates (Works inside `VaultStream.exe`!)
- Because `VaultStream.exe` supervises the live local Git repo instead of freezing source files inside the binary, updates pushed by `arena.ai` or collaborators continue auto-applying without rebuilding the `.exe`.
- On launch, `VaultStream.exe` pulls the latest `origin/main` commits automatically, opens a standalone Edge/Chrome app window, and runs the server with `VAULTSTREAM_SUPERVISED=1`.
- While running, VaultStream automatically checks `origin/main` every 20 seconds (`AUTO_UPDATE_INTERVAL_MS`, set `AUTO_UPDATE=0` to disable), pulls new commits via `git pull --rebase --autostash`, restarts automatically if backend files changed, and refreshes the app UI cleanly.
- You can also run **`Pull-From-GitHub.bat`** or **`Push-To-GitHub.bat`** manually at any time.

### Environment Variables (Optional)
- `PORT` (default `3456`)
- `HOST` (default `127.0.0.1`)
- `DATA_DIR` (default `./data`)
- `CACHE_DIR` (default `./cache`)
- `MAX_CACHE_BYTES` (default `2147483648` = 2 GB)

## Verification
```bash
npm run typecheck
npm test
```

## Notes for Phase 2 (iOS / SwiftUI Port)
- **SQLite FTS5**: `src/db.ts` schema & `tracks_fts` virtual table port directly to `GRDB.swift` / `SQLite.swift`.
- **Host Link Resolver**: `src/resolver.ts` rules port cleanly to `URLSession` async/await resolvers.
- **Byte-Range Progressive Cache**: `src/cache.ts` segment model maps cleanly to `AVAssetResourceLoaderDelegate` (for FLAC/ALAC/WAV/MP3 playback with `AVPlayer`) and disk LRU eviction in `Library/Caches`.
