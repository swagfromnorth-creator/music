import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { generateDemoWavBuffer } from "../src/demo.ts";
import { LOCAL_LIBRARY_TRACKER_ID, scanLocalMusicFolder } from "../src/local-library.ts";
import { cleanMessyTrackTitle, lookupMusicBrainzMetadata, parseSpotifyPlaylistInput } from "../src/musicbrainz.ts";
import { detectHost, resolveHostUrl } from "../src/resolver.ts";
import { createAppServer, type AppContext } from "../src/server.ts";

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
  });
});
