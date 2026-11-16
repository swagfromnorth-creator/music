import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { AppDatabase } from "../src/db.ts";
import { generateDemoWavBuffer } from "../src/demo.ts";
import { LOCAL_LIBRARY_TRACKER_ID, scanLocalMusicFolder } from "../src/local-library.ts";
import { findFfmpegExecutable, isCollectionUrl, remuxStreamToFile } from "../src/media-tools.ts";
import { cleanMessyTrackTitle, lookupMusicBrainzMetadata, parseSpotifyPlaylistInput } from "../src/musicbrainz.ts";
import { detectHost, resolveHostUrl } from "../src/resolver.ts";
import { createAppServer, type AppContext } from "../src/server.ts";
import { scoreTrackCandidate } from "../src/smart-matcher.ts";
import { curateTrackerResult, normalizeTrackerPayload } from "../src/tracker.ts";

describe("media extraction, local scanner, MusicBrainz normalization & Spotify migration", () => {
  let ctx: AppContext | null = null;
  let tmpDir: string | null = null;

  afterEach(async () => {
    if (ctx) {
      await ctx.close();
      ctx = null;
    }
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = null;
    }
  });

  it("cleans messy YouTube/SoundCloud titles and channel names", () => {
    const a = cleanMessyTrackTitle(
      "Frank Ocean - Nights (Official Audio) [HQ] (feat. Sample Artist) | Blonde",
      "Frank Ocean - Topic"
    );
    assert.equal(a.artist, "Frank Ocean");
    assert.equal(a.title, "Nights");

    const b = cleanMessyTrackTitle("Self Control (Official Music Video)", "BlondeVEVO");
    assert.equal(b.artist, "Blonde");
    assert.equal(b.title, "Self Control");
  });

  it("queries MusicBrainz and Cover Art Archive cleanly via fetch", async () => {
    const fakeFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      if (url.includes("musicbrainz.org/ws/2/recording/")) {
        return new Response(
          JSON.stringify({
            recordings: [
              {
                id: "rec-123",
                title: "Nights",
                score: 99,
                "artist-credit": [{ name: "Frank Ocean" }],
                releases: [
                  {
                    id: "rel-456",
                    title: "Blonde",
                    status: "Official",
                    date: "2016-08-20",
                    "release-group": { id: "rg-789", "primary-type": "Album" },
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("coverartarchive.org/release-group/rg-789/front-500") && init?.method === "HEAD") {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    const match = await lookupMusicBrainzMetadata("Frank Ocean - Nights (Official Audio)", "", fakeFetch);
    assert.ok(match);
    assert.equal(match.mbid, "rec-123");
    assert.equal(match.title, "Nights");
    assert.equal(match.artist, "Frank Ocean");
    assert.equal(match.album, "Blonde");
    assert.equal(match.year, "2016");
    assert.equal(match.coverArtUrl, "https://coverartarchive.org/release-group/rg-789/front-500");
  });

  it("parses SpotDL JSON, Exportify CSV (quoted commas), and plain tracklist formats", () => {
    const csv = [
      'Track Name,Artist Name,Album Name,"Duration (ms)"',
      '"Pink + White",Frank Ocean,Blonde,184516',
      '"Super Rich Kids",Frank Ocean;Earl Sweatshirt,"channel ORANGE",304000',
    ].join("\n");
    const parsedCsv = parseSpotifyPlaylistInput(csv);
    assert.equal(parsedCsv.length, 2);
    assert.equal(parsedCsv[0]?.title, "Pink + White");
    assert.equal(parsedCsv[0]?.durationSec, 185);
    assert.equal(parsedCsv[1]?.artist, "Frank Ocean, Earl Sweatshirt");
    assert.equal(parsedCsv[1]?.album, "channel ORANGE");

    const json = JSON.stringify({
      tracks: [
        {
          name: "Pyramids",
          artists: ["Frank Ocean"],
          album_name: "channel ORANGE",
          duration: 592,
          url: "https://www.youtube.com/watch?v=test123",
        },
      ],
    });
    const parsedJson = parseSpotifyPlaylistInput(json);
    assert.equal(parsedJson.length, 1);
    assert.equal(parsedJson[0]?.title, "Pyramids");
    assert.equal(parsedJson[0]?.externalUrl, "https://www.youtube.com/watch?v=test123");

    const text = "1. Kanye West - Flashing Lights\n2. Travis Scott - 90210 [HQ]";
    const parsedText = parseSpotifyPlaylistInput(text);
    assert.equal(parsedText.length, 2);
    assert.equal(parsedText[0]?.artist, "Kanye West");
    assert.equal(parsedText[0]?.title, "Flashing Lights");
    assert.equal(parsedText[1]?.title, "90210");
  });

  it("detects YouTube, Bandcamp, and local URLs and resolves YouTube/Bandcamp via ytDlpResolver", async () => {
    assert.equal(detectHost("https://music.youtube.com/watch?v=abc123"), "youtube");
    assert.equal(detectHost("https://youtu.be/abc123"), "youtube");
    assert.equal(detectHost("https://artist.bandcamp.com/track/demo-cut"), "bandcamp");
    assert.equal(detectHost("file://C:/Music/song.flac"), "local");

    const resolved = await resolveHostUrl("https://www.youtube.com/watch?v=demoVid", fetch, {
      ytDlpResolver: async () => ({
        streamUrl: "https://rr1---sn.googlevideo.com/videoplayback?mime=audio/mp4",
        ext: "m4a",
        acodec: "mp4a.40.2",
        sampleRateHz: 44100,
        abr: 128,
        filesize: 3456789,
        title: "Demo Song (Official Audio)",
        artist: "Demo Artist",
        album: "Demo Tape",
        durationSec: 185,
        thumbnail: "https://i.ytimg.com/vi/demoVid/hqdefault.jpg",
        httpHeaders: { "User-Agent": "Mozilla/5.0" },
      }),
    });

    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(resolved.host, "youtube");
      assert.equal(resolved.mimeType, "audio/mp4");
      assert.equal(resolved.durationSec, 185);
      assert.equal(resolved.httpHeaders?.["User-Agent"], "Mozilla/5.0");
    }
  });

  it("scans a local folder of WAV files, enriches via /api/metadata/musicbrainz, migrates Spotify list, and streams local 206 ranges", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vaultstream-media-test-"));
    const musicFolder = path.join(tmpDir, "MyLosslessAlbum");
    fs.mkdirSync(musicFolder, { recursive: true });
    const wavPath = path.join(musicFolder, "Studio Cut - Test Master.wav");
    const wavBuf = generateDemoWavBuffer("studio-cut-test-master");
    fs.writeFileSync(wavPath, wavBuf);

    const mockFetch = async (input: string, init?: RequestInit): Promise<Response> => {
      if (input.includes("musicbrainz.org/ws/2/recording/")) {
        return new Response(
          JSON.stringify({
            recordings: [
              {
                id: "mb-cut-1",
                title: "Studio Cut (Normalized)",
                score: 98,
                "artist-credit": [{ name: "Signal Architect" }],
                releases: [
                  {
                    id: "rel-cut-1",
                    title: "Midnight Archive",
                    status: "Official",
                    date: "2024-05-01",
                    "release-group": { id: "rg-cut-1", "primary-type": "Album" },
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (input.includes("coverartarchive.org/release-group/rg-cut-1/front-500") && init?.method === "HEAD") {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    ctx = createAppServer({
      dbPath: path.join(tmpDir, "test.db"),
      cacheDir: path.join(tmpDir, "cache"),
      imagesDir: path.join(tmpDir, "images"),
      fetchImpl: mockFetch,
    });

    await new Promise<void>((resolve) => ctx!.server.listen(0, "127.0.0.1", () => resolve()));
    const addr = ctx.server.address();
    assert.ok(addr && typeof addr === "object");
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    // 1. Scan local folder via HTTP route
    const scanRes = await fetch(`${baseUrl}/api/library/scan-local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderPath: musicFolder }),
    });
    assert.equal(scanRes.status, 200);
    const scanData = (await scanRes.json()) as {
      scannedFiles: number;
      indexedTracks: number;
      tracker: { trackerId: string };
    };
    assert.equal(scanData.scannedFiles, 1);
    assert.equal(scanData.indexedTracks, 1);
    assert.equal(scanData.tracker.trackerId, LOCAL_LIBRARY_TRACKER_ID);

    const tracksRes = await fetch(`${baseUrl}/api/tracks?trackerId=${LOCAL_LIBRARY_TRACKER_ID}`);
    const tracksJson = (await tracksRes.json()) as { tracks: Array<{ id: string; primaryHost: string }> };
    assert.equal(tracksJson.tracks.length, 1);
    const localTrack = tracksJson.tracks[0]!;
    assert.equal(localTrack.primaryHost, "local");

    // 2. Verify local 206 byte-range streaming without duplicating file into cache
    const rangeRes = await fetch(`${baseUrl}/api/tracks/${localTrack.id}/stream`, {
      headers: { Range: "bytes=0-1023" },
    });
    assert.equal(rangeRes.status, 206);
    assert.equal(rangeRes.headers.get("x-cache-status"), "LOCAL");
    assert.equal(rangeRes.headers.get("content-range"), `bytes 0-1023/${wavBuf.length}`);
    const slice = Buffer.from(await rangeRes.arrayBuffer());
    assert.equal(slice.length, 1024);
    assert.ok(slice.subarray(0, 4).toString("ascii") === "RIFF");

    // 3. Verify MusicBrainz enrichment endpoint updates the track in SQLite
    const mbRes = await fetch(`${baseUrl}/api/metadata/musicbrainz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: localTrack.id }),
    });
    assert.equal(mbRes.status, 200);
    const mbData = (await mbRes.json()) as {
      matched: boolean;
      track: { title: string; artist: string; era: string; eraImage: string | null };
    };
    assert.equal(mbData.matched, true);
    assert.equal(mbData.track.title, "Studio Cut (Normalized)");
    assert.equal(mbData.track.artist, "Signal Architect");
    assert.equal(mbData.track.era, "Midnight Archive");
    assert.equal(mbData.track.eraImage, "https://coverartarchive.org/release-group/rg-cut-1/front-500");

    // 4. Verify Spotify migration matches against SQLite local track & creates playlist
    const spfRes = await fetch(`${baseUrl}/api/import/spotify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playlistName: "Migrated Mix",
        resolveOnline: false,
        content: "Track Name,Artist Name\nStudio Cut (Normalized),Signal Architect\nMissing Song,Unknown",
      }),
    });
    assert.equal(spfRes.status, 200);
    const spfData = (await spfRes.json()) as {
      totalParsed: number;
      matchedLocal: number;
      unmatchedCount: number;
      tracksAdded: number;
      playlist: { name: string; tracks: Array<{ id: string }> };
    };
    assert.equal(spfData.totalParsed, 2);
    assert.equal(spfData.matchedLocal, 1);
    assert.equal(spfData.unmatchedCount, 1);
    assert.equal(spfData.tracksAdded, 1);
    assert.equal(spfData.playlist.name, "Migrated Mix");
    assert.equal(spfData.playlist.tracks[0]?.id, localTrack.id);

    // Also verify scanLocalMusicFolder directly counts zero missing
    const directStats = await scanLocalMusicFolder(musicFolder, ctx.db, path.join(tmpDir, "images"));
    assert.equal(directStats.indexedTracks, 1);

    // 5. Verify ffmpeg remux/transcode produces playable non-empty MP3/MP4 stream when available
    if (findFfmpegExecutable()) {
      const remuxOut = path.join(tmpDir, "remux-test.bin");
      const rInfo = await remuxStreamToFile(wavPath, remuxOut);
      assert.ok(rInfo.sizeBytes > 1024);
      assert.ok(rInfo.mimeType === "audio/mp4" || rInfo.mimeType === "audio/mpeg");
    }
  });

  it("curates trackers: removes non-songs and unplayable links, isolates unavailable songs, and blocks duplicate songs unless different versions", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vaultstream-curate-test-"));
    const db = new AppDatabase(path.join(tmpDir, "curate.db"));
    try {

    const v3Payload = {
      name: "Test Artist Tracker",
      tab: { name: "Unreleased", slug: "unreleased", gid: "1" },
      tabs: [
        { name: "Unreleased", slug: "unreleased", gid: "1" },
        { name: "Interviews (CA)", slug: "interviews", gid: "2" },
        { name: "🎨 Art", slug: "art", gid: "3" },
      ],
      eras: [
        {
          name: "Era One",
          tracks: [
            {
              name: { raw: "Skyline", title: "Skyline" },
              quality: "Lossless",
              type: "Throwaway",
              links: [{ url: "https://pillows.su/f/11111111111111111111111111111111" }],
            },
            {
              name: { raw: "Skyline", title: "Skyline" },
              quality: "High Quality",
              type: "Throwaway",
              links: [{ url: "https://pixeldrain.com/u/Skyline2" }],
            },
            {
              name: { raw: "Skyline [V2]", title: "Skyline [V2]" },
              quality: "Lossless",
              type: "Demo",
              links: [{ url: "https://pillows.su/f/22222222222222222222222222222222" }],
            },
            {
              name: { raw: "[Unheard Oct 2022 Sessions]", title: "[Unheard Oct 2022 Sessions]" },
              quality: "Lossless",
              type: "Sessions",
              links: [{ url: "https://pillows.su/f/33333333333333333333333333333333" }],
            },
            {
              name: { raw: "No Link Track", title: "No Link Track" },
              quality: "Lossless",
              links: [],
            },
            {
              name: { raw: "Snippet Cut", title: "Snippet Cut" },
              quality: "Not Available",
              links: [{ url: "https://www.youtube.com/watch?v=snip123" }],
            },
          ],
        },
      ],
    };

    const rawNormalized = normalizeTrackerPayload("test_tracker_1", v3Payload);
    const curated = curateTrackerResult(rawNormalized);

    // Non-song tabs (Interviews/Art) removed, Unavailable tab added cleanly
    assert.deepEqual(
      curated.tracker.tabs.map((t) => t.name),
      ["Unreleased", "Unavailable"]
    );
    // Available songs: Skyline (deduped with 2 links merged!) + Skyline [V2] (distinct version!)
    const active = curated.tracks.filter((t) => t.tabName !== "Unavailable");
    assert.equal(active.length, 2);
    assert.equal(active[0]?.title, "Skyline");
    assert.equal(active[0]?.links.length, 2);
    assert.equal(active[1]?.title, "Skyline [V2]");

    // Unavailable song moved to Unavailable tab; No Link Track + Sessions row dropped completely
    const unavail = curated.tracks.filter((t) => t.tabName === "Unavailable");
    assert.equal(unavail.length, 1);
    assert.equal(unavail[0]?.title, "Snippet Cut");

    db.upsertSyncedTracker(curated.tracker, curated.tracks);

    // Global search excludes Unavailable tab automatically, but explicit tabName='Unavailable' finds it
    const globalSearch = db.searchTracks({ trackerId: "test_tracker_1", playableOnly: true });
    assert.equal(globalSearch.tracks.length, 2);
    const unavailSearch = db.searchTracks({ trackerId: "test_tracker_1", tabName: "Unavailable" });
    assert.equal(unavailSearch.tracks.length, 1);
    assert.equal(unavailSearch.tracks[0]?.title, "Snippet Cut");

    // Library & Playlist deduplication: same song+version rejected unless distinct version
    const tSky1 = db.upsertImportedTrack(
      { trackerId: "imported_web", name: "Imported Web Tracks", artistName: "Web & Streaming" },
      {
        ...active[0]!,
        id: "imp_unforg_1",
        title: "Unforgettable",
        artist: "French Montana",
        primaryUrl: "https://www.youtube.com/watch?v=dup1",
        links: [{ url: "https://www.youtube.com/watch?v=dup1", host: "youtube", playable: true, formatHint: null }],
      }
    );
    const tSkyDup = db.upsertImportedTrack(
      { trackerId: "imported_web", name: "Imported Web Tracks", artistName: "Web & Streaming" },
      {
        ...active[0]!,
        id: "imp_unforg_2",
        title: "Unforgettable ft. Swae Lee",
        artist: "French Montana",
        primaryUrl: "https://soundcloud.com/test/unforgettable",
        links: [{ url: "https://soundcloud.com/test/unforgettable", host: "soundcloud", playable: true, formatHint: null }],
      }
    );
    // Same song merged cleanly instead of creating a duplicate card!
    assert.equal(tSkyDup.id, tSky1.id);
    assert.equal(tSkyDup.links.length, 2);

    // Distinct version IS allowed
    const tSkyRemix = db.upsertImportedTrack(
      { trackerId: "imported_web", name: "Imported Web Tracks", artistName: "Web & Streaming" },
      {
        ...active[0]!,
        id: "imp_unforg_remix",
        title: "Unforgettable (Acoustic)",
        artist: "French Montana",
        primaryUrl: "https://www.youtube.com/watch?v=acoustic1",
        links: [{ url: "https://www.youtube.com/watch?v=acoustic1", host: "youtube", playable: true, formatHint: null }],
      }
    );
    assert.notEqual(tSkyRemix.id, tSky1.id);

    const pl = db.createPlaylist({ name: "No Dupes Playlist" });
    assert.equal(db.addTrackToPlaylist(pl.id, active[0]!.id), true);
    assert.equal(db.addTrackToPlaylist(pl.id, tSky1.id), true);
    assert.equal(db.addTrackToPlaylist(pl.id, active[1]!.id), true); // [V2] different version allowed!
    assert.equal(db.addTrackToPlaylist(pl.id, tSkyRemix.id), true); // (Acoustic) different version allowed!

    // Duplicate same-song same-version (even from another track ID/mirror) blocked from same playlist!
    const anotherSameVersion = db.upsertImportedTrack(
      { trackerId: "spotify_imports", name: "Spotify", artistName: "Spotify" },
      {
        ...active[0]!,
        id: "other_unforg_copy",
        title: "Unforgettable",
        artist: "French Montana, Swae Lee",
        primaryUrl: "https://pillows.su/f/44444444444444444444444444444444",
        links: [],
      }
    );
    // Also test explicit addTrackToPlaylist duplicate rejection for Unforgettable ft. Swae Lee vs Unforgettable
    assert.equal(db.addTrackToPlaylist(pl.id, anotherSameVersion.id), false);
    assert.equal(db.addTrackToPlaylist(pl.id, active[0]!.id), false);

    // Unavailable playlist/library song stays present with isUnavailable=true until recovered
    db.setTrackUnavailable(tSky1.id, true);
    const plWithUnavail = db.getPlaylistDetail(pl.id)!;
    const unavailEntry = plWithUnavail.tracks.find((x) => x.id === tSky1.id);
    assert.equal(unavailEntry?.isUnavailable, true);
    db.setTrackUnavailable(tSky1.id, false);
    assert.equal(db.getTrackById(tSky1.id)?.isUnavailable, false);

    // Browser cookies setting persistence
    assert.equal(db.setCookiesBrowser("chrome"), "chrome");
    assert.equal(db.getCookiesBrowser(), "chrome");

    // Collection URL detection for YouTube Music albums, YouTube playlists, and SoundCloud sets
    assert.equal(isCollectionUrl("https://music.youtube.com/browse/MPREb_or9GipYFiAw"), true);
    assert.equal(isCollectionUrl("https://www.youtube.com/playlist?list=PL12345"), true);
    assert.equal(isCollectionUrl("https://soundcloud.com/artist/sets/album-name"), true);
    assert.equal(isCollectionUrl("https://www.youtube.com/watch?v=48ydDUQ16RE"), false);
    } finally {
      db.close();
    }
  });

  it("smart-imports songs across ArtistGrid directory, YT Music, SoundCloud & YouTube via metadata and reports unmatched songs", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vaultstream-smart-import-"));

    // Verify metadata scoring penalizes slowed/type-beat uploads and boosts album+duration matches
    const realHit = scoreTrackCandidate(
      { title: "Nights", artist: "Frank Ocean", album: "Blonde", durationSec: 307 },
      { title: "Nights", artist: "Frank Ocean", albumOrEra: "Blonde", durationSec: 307, source: "ytmusic" }
    );
    const slowedHit = scoreTrackCandidate(
      { title: "Nights", artist: "Frank Ocean", album: "Blonde", durationSec: 307 },
      { title: "Nights (Slowed + Reverb) 1 Hour", artist: "Random Uploader", albumOrEra: null, durationSec: 900, source: "youtube" }
    );
    const wrongArtistSameWords = scoreTrackCandidate(
      { title: "Nights", artist: "Frank Ocean", album: "Blonde", durationSec: 307 },
      { title: "✨ Frank Ocean - Nights", artist: "Kendrick Lamar", albumOrEra: "To Pimp A Butterfly [V2]", durationSec: null, source: "artistgrid" }
    );
    assert.ok(realHit.score > 80);
    assert.ok(slowedHit.score < 50);
    assert.ok(wrongArtistSameWords.score < 50);

    let trackerSyncCalls = 0;
    ctx = createAppServer({
      dbPath: path.join(tmpDir, "test.db"),
      cacheDir: path.join(tmpDir, "cache"),
      fetchDirectoryImpl: async () => [
        {
          name: "Kanye West",
          trackerId: "kanye_grid_tracker_id_1234567890",
          url: "https://artistgrid.cx/tracker/kanye_grid_tracker_id_1234567890",
          isLinkWorking: true,
          isUpdated: true,
          isStarred: true,
        },
      ],
      syncTrackerImpl: async (trackerId) => {
        trackerSyncCalls++;
        return {
          tracker: {
            trackerId,
            name: "Kanye West Tracker",
            artistName: "Kanye West",
            currentTab: "Unreleased",
            tabs: [{ name: "Unreleased", slug: "unreleased", gid: "0" }],
            trackCount: 1,
            playableCount: 1,
            credits: null,
          },
          tracks: [
            {
              id: "ag_can_u_be",
              trackerId,
              tabName: "Unreleased",
              title: "Can U Be",
              rawName: "Can U Be",
              credits: "",
              artist: "Kanye West",
              era: "Turbo Grafx 16",
              subEra: "Default",
              eraOrder: 0,
              trackOrder: 0,
              eraColor: "#7c3aed",
              eraTextColor: "#ffffff",
              eraImage: null,
              notes: "Leaked session",
              quality: "Lossless",
              formatHint: "flac",
              trackLength: "3:45",
              availableLength: null,
              leakDate: null,
              fileDate: null,
              trackType: "Leak",
              primaryUrl: "https://pillows.su/f/1234567890abcdef1234567890abcdef",
              primaryHost: "pillows",
              links: [
                {
                  url: "https://pillows.su/f/1234567890abcdef1234567890abcdef",
                  host: "pillows",
                  playable: true,
                  formatHint: "flac",
                },
              ],
              resolvedUrl: null,
              resolvedMime: null,
              resolvedSize: null,
              resolvedFilename: null,
              resolvedAt: null,
              isPlayable: true,
              audioMeta: null,
            },
          ],
          erasCount: 1,
        };
      },
      searchOnlineImpl: async (query, source) => {
        const q = query.toLowerCase();
        if (q.includes("nights") && source === "ytmusic") {
          return [
            {
              id: "ytm_slow",
              source: "ytmusic",
              url: "https://www.youtube.com/watch?v=slowed1",
              title: "Nights (Slowed + Reverb)",
              artist: "LoFi Channel",
              album: null,
              durationSec: 420,
              durationText: "7:00",
              thumbnail: null,
            },
            {
              id: "ytm_real",
              source: "ytmusic",
              url: "https://www.youtube.com/watch?v=realNights",
              title: "Nights",
              artist: "Frank Ocean",
              album: "Blonde",
              durationSec: 307,
              durationText: "5:07",
              thumbnail: "https://example.com/blonde.jpg",
            },
          ];
        }
        if (q.includes("skyfall") && source === "soundcloud") {
          return [
            {
              id: "sc_skyfall",
              source: "soundcloud",
              url: "https://soundcloud.com/travisscott/skyfall",
              title: "Skyfall (feat. Young Thug)",
              artist: "Travis Scott",
              album: "Days Before Rodeo",
              durationSec: 319,
              durationText: "5:19",
              thumbnail: null,
            },
          ];
        }
        return [];
      },
    });

    await new Promise<void>((resolve) => ctx!.server.listen(0, "127.0.0.1", resolve));
    const addr = ctx.server.address() as { port: number };
    const base = `http://127.0.0.1:${addr.port}`;

    const csvInput = [
      "Track Name,Artist Name,Album Name,Duration (ms)",
      "Can U Be,Kanye West,Turbo Grafx 16,225000",
      "Nights,Frank Ocean,Blonde,307000",
      "Skyfall,Travis Scott,Days Before Rodeo,319000",
      "Totally Nonexistent Unfindable Track 999,Unknown Ghost,Lost Era,",
    ].join("\n");

    const res = await fetch(`${base}/api/import/spotify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playlistName: "Smart Test Import",
        content: csvInput,
        sourcePreference: "auto",
      }),
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      totalParsed: number;
      tracksAdded: number;
      unmatchedCount: number;
      unmatched: Array<{ title: string; artist: string; album: string | null; sourcesChecked: string[] }>;
      sourceBreakdown: { artistgrid: number; ytmusic: number; soundcloud: number; youtube: number };
      autoSyncedTrackers: string[];
      matchedItems: Array<{ matchedTitle: string; matchedSource: string }>;
    };

    assert.equal(trackerSyncCalls, 1);
    assert.equal(json.totalParsed, 4);
    assert.equal(json.tracksAdded, 3);
    assert.equal(json.sourceBreakdown.artistgrid, 1);
    assert.equal(json.sourceBreakdown.ytmusic, 1);
    assert.equal(json.sourceBreakdown.soundcloud, 1);
    assert.equal(json.autoSyncedTrackers.length, 1);

    const ytmMatch = json.matchedItems.find((m) => m.matchedSource === "ytmusic");
    assert.equal(ytmMatch?.matchedTitle, "Nights");

    assert.equal(json.unmatchedCount, 1);
    assert.equal(json.unmatched[0]?.title, "Totally Nonexistent Unfindable Track 999");
    assert.ok(json.unmatched[0]?.sourcesChecked.includes("artistgrid"));
    assert.ok(json.unmatched[0]?.sourcesChecked.includes("ytmusic"));
    assert.ok(json.unmatched[0]?.sourcesChecked.includes("soundcloud"));
    assert.ok(json.unmatched[0]?.sourcesChecked.includes("youtube"));
  });
});
