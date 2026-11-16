import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { parseAudioHeader, parseRangeHeader } from "../src/cache.ts";
import { createAppServer } from "../src/server.ts";

function buildSyntheticFlac(payloadBytes: number): Buffer {
  const buf = Buffer.alloc(payloadBytes, 0xaa);
  // "fLaC" magic + STREAMINFO block (type 0, length 34)
  buf.write("fLaC", 0, "ascii");
  buf[4] = 0x80; // last metadata block = 1, type = 0 (STREAMINFO)
  buf[5] = 0x00;
  buf[6] = 0x00;
  buf[7] = 34;

  // STREAMINFO starts at byte 8; offset 18..25 holds sampleRate (20b), channels-1 (3b), bps-1 (5b), totalSamples (36b)
  // 48000 Hz = 0x0BB80; channels = 2 -> (1); bps = 24 -> (23); totalSamples = 480000 (10s)
  const sr = 48000;
  const chMinus1 = 1;
  const bpsMinus1 = 23;
  buf[18] = (sr >> 12) & 0xff;
  buf[19] = (sr >> 4) & 0xff;
  buf[20] = ((sr & 0x0f) << 4) | ((chMinus1 & 0x07) << 1) | ((bpsMinus1 >> 4) & 0x01);
  buf[21] = ((bpsMinus1 & 0x0f) << 4) | 0; // high 4 bits of totalSamples = 0
  buf.writeUInt32BE(480000, 22);
  return buf;
}

describe("progressive byte-range cache, FLAC header parsing & LRU eviction", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const d of tempDirs.splice(0)) {
      await fsp.rm(d, { recursive: true, force: true });
    }
  });

  it("parses FLAC STREAMINFO headers and HTTP Range headers", () => {
    const flac = buildSyntheticFlac(1024);
    const info = parseAudioHeader(flac, "audio/flac");
    assert.deepEqual(info, {
      codec: "FLAC",
      sampleRateHz: 48000,
      bitsPerSample: 24,
      channels: 2,
      durationSec: 10,
      lossless: true,
    });

    assert.deepEqual(parseRangeHeader("bytes=0-99", 500), {
      hasRangeHeader: true,
      start: 0,
      end: 99,
      explicitEnd: 99,
    });
    assert.deepEqual(parseRangeHeader("bytes=-100", 500), {
      hasRangeHeader: true,
      start: 400,
      end: 499,
      explicitEnd: 499,
    });
    assert.equal(parseRangeHeader("bytes=600-700", 500).invalid, true);
  });

  it("streams lossless tracks via 206 Range requests, merges progressive segments, and evicts LRU entries", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "vaultstream-test-"));
    tempDirs.push(tmp);

    const fileA = buildSyntheticFlac(1000);
    // Give each track distinct trailing bytes so integrity checks verify byte accuracy
    for (let i = 64; i < fileA.length; i++) fileA[i] = i % 251;
    const fileB = buildSyntheticFlac(1000);
    for (let i = 64; i < fileB.length; i++) fileB[i] = (i * 3) % 251;
    const fileC = buildSyntheticFlac(1000);
    for (let i = 64; i < fileC.length; i++) fileC[i] = (i * 7) % 251;

    const filesById: Record<string, Buffer> = {
      aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: fileA,
      bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb: fileB,
      cccccccccccccccccccccccccccccccc: fileC,
    };

    let upstreamHits = 0;

    const mockFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      if (url.startsWith("https://trackerapi.artistgrid.cx/sh/")) {
        return new Response(
          JSON.stringify({
            name: "Test Artist Tracker",
            tab: { name: "Unreleased", slug: "main", gid: "1" },
            tabs: [{ name: "Unreleased", slug: "main", gid: "1" }],
            eras: [
              {
                name: "Era One",
                tracks: [
                  {
                    name: { raw: "Track A", title: "Track A", credits: [] },
                    quality: "Lossless",
                    links: [{ url: "https://pillows.su/f/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
                  },
                  {
                    name: { raw: "Track B", title: "Track B", credits: [] },
                    quality: "Lossless",
                    links: [{ url: "https://pillows.su/f/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }],
                  },
                  {
                    name: { raw: "Track C", title: "Track C", credits: [] },
                    quality: "Lossless",
                    links: [{ url: "https://pillows.su/f/cccccccccccccccccccccccccccccccc" }],
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      const idMatch = url.match(/api\.pillows\.su\/api\/download\/([a-f0-9]+)/);
      if (idMatch?.[1] && filesById[idMatch[1]]) {
        upstreamHits++;
        const buf = filesById[idMatch[1]]!;
        const hdrs = new Headers(init?.headers);
        const range = hdrs.get("range");
        if (range) {
          const m = range.match(/bytes=(\d+)-(\d*)/);
          const start = Number(m?.[1] ?? 0);
          const end = m?.[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
          const slice = buf.subarray(start, end + 1);
          return new Response(new Uint8Array(slice), {
            status: 206,
            headers: {
              "Content-Type": "audio/flac",
              "Accept-Ranges": "bytes",
              "Content-Range": `bytes ${start}-${end}/${buf.length}`,
              "Content-Length": String(slice.length),
            },
          });
        }
        return new Response(new Uint8Array(buf), {
          status: 200,
          headers: {
            "Content-Type": "audio/flac",
            "Accept-Ranges": "bytes",
            "Content-Length": String(buf.length),
          },
        });
      }

      return new Response("Not found", { status: 404 });
    };

    const app = createAppServer({
      dbPath: path.join(tmp, "test.db"),
      cacheDir: path.join(tmp, "cache"),
      fetchImpl: mockFetch,
    });

    await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const addr = app.server.address();
    assert.ok(addr && typeof addr === "object");
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    try {
      // 1. Sync tracker
      const syncRes = await fetch(`${baseUrl}/api/trackers/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "1i4OQglDHiiqMDthqfUFPutGmpZzK7n63LaoWApqhQXI" }),
      });
      assert.equal(syncRes.status, 200);
      const syncJson = (await syncRes.json()) as { tracksSynced: number };
      assert.equal(syncJson.tracksSynced, 3);

      // 2. Search tracks
      const listRes = await fetch(`${baseUrl}/api/tracks`);
      const listJson = (await listRes.json()) as { tracks: Array<{ id: string; title: string }> };
      const trackA = listJson.tracks.find((t) => t.title === "Track A")!;
      const trackB = listJson.tracks.find((t) => t.title === "Track B")!;
      const trackC = listJson.tracks.find((t) => t.title === "Track C")!;

      // 3. Stream partial prefix [0..199] -> MISS
      const r1 = await fetch(`${baseUrl}/api/tracks/${trackA.id}/stream`, {
        headers: { Range: "bytes=0-199" },
      });
      assert.equal(r1.status, 206);
      assert.equal(r1.headers.get("x-cache-status"), "MISS");
      assert.equal(r1.headers.get("content-range"), "bytes 0-199/1000");
      const b1 = Buffer.from(await r1.arrayBuffer());
      assert.deepEqual(b1, fileA.subarray(0, 200));
      assert.equal(upstreamHits, 1);

      // 4. Re-request [0..199] -> HIT (zero upstream calls!)
      const r2 = await fetch(`${baseUrl}/api/tracks/${trackA.id}/stream`, {
        headers: { Range: "bytes=0-199" },
      });
      assert.equal(r2.status, 206);
      assert.equal(r2.headers.get("x-cache-status"), "HIT");
      const b2 = Buffer.from(await r2.arrayBuffer());
      assert.deepEqual(b2, fileA.subarray(0, 200));
      assert.equal(upstreamHits, 1);

      // 5. Request [0..999] -> PARTIAL-HIT (stitches [0..199] from disk + [200..999] from upstream, merges!)
      const r3 = await fetch(`${baseUrl}/api/tracks/${trackA.id}/stream`, {
        headers: { Range: "bytes=0-" },
      });
      assert.equal(r3.status, 206);
      assert.equal(r3.headers.get("x-cache-status"), "PARTIAL-HIT");
      const b3 = Buffer.from(await r3.arrayBuffer());
      assert.deepEqual(b3, fileA);
      assert.equal(upstreamHits, 2);

      // Verify FLAC header was parsed & stored on Track A
      const detailA = (await (await fetch(`${baseUrl}/api/tracks/${trackA.id}`)).json()) as {
        track: { audioMeta: { codec: string; sampleRateHz: number; bitsPerSample: number } };
      };
      assert.equal(detailA.track.audioMeta.codec, "FLAC");
      assert.equal(detailA.track.audioMeta.sampleRateHz, 48000);
      assert.equal(detailA.track.audioMeta.bitsPerSample, 24);

      // 6. Cache Track B and Track C completely
      await fetch(`${baseUrl}/api/tracks/${trackB.id}/cache`, { method: "POST", body: "{}" });
      await new Promise((r) => setTimeout(r, 15));
      await fetch(`${baseUrl}/api/tracks/${trackC.id}/cache`, { method: "POST", body: "{}" });
      await new Promise((r) => setTimeout(r, 15));

      // Touch Track A so LRU order from oldest -> newest is: Track B, Track C, Track A
      await fetch(`${baseUrl}/api/tracks/${trackA.id}/stream`, { headers: { Range: "bytes=0-10" } });

      // 7. Set cache cap to 2,200 bytes (Track A + B + C = 3,000 bytes -> oldest Track B must be evicted!)
      // Use db.setMaxCacheBytes directly for <1MB test precision, then trigger eviction via /api/cache/config or evictIfNeeded
      app.db.setSetting("max_cache_bytes", "2200");
      const evicted = await app.cache.evictIfNeeded();
      assert.equal(evicted, 1);

      const stats = app.cache.getStats();
      assert.equal(stats.entryCount, 2);
      assert.equal(stats.totalCachedBytes, 2000);
      const cachedTitles = stats.entries.map((e) => e.trackTitle).sort();
      assert.deepEqual(cachedTitles, ["Track A", "Track C"]);

      // Verify ./cache on disk only has 2 directories left
      const diskDirs = fs.readdirSync(path.join(tmp, "cache"));
      assert.equal(diskDirs.length, 2);
    } finally {
      await app.close();
    }
  });
});
