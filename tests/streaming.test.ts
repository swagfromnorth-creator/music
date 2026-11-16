import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { parseAudioHeader } from "../src/cache.ts";
import { buildDemoSeedPayload, generateDemoWavBuffer } from "../src/demo.ts";
import { createAppServer, type AppContext } from "../src/server.ts";

describe("streaming platform features (playlists, likes, profile, history, demo audio)", () => {
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

  it("generates valid 16-bit 44.1kHz stereo lossless WAV buffers for demo playback", () => {
    const buf = generateDemoWavBuffer("midnight-velvet-melbourne");
    const header = parseAudioHeader(buf, "audio/wav");
    assert.ok(header);
    assert.equal(header.codec, "WAV");
    assert.equal(header.sampleRateHz, 44100);
    assert.equal(header.bitsPerSample, 16);
    assert.equal(header.channels, 2);
    assert.equal(header.lossless, true);
  });

  it("supports end-to-end profile, playlists, likes, follows, history, recent searches, and 206 streaming", async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vaultstream-ui-test-"));
    ctx = createAppServer({
      dbPath: path.join(tmpDir, "test.db"),
      cacheDir: path.join(tmpDir, "cache"),
      imagesDir: path.join(tmpDir, "images"),
    });

    await new Promise<void>((resolve) => ctx!.server.listen(0, "127.0.0.1", () => resolve()));
    const addr = ctx.server.address();
    assert.ok(addr && typeof addr === "object");
    const base = `http://127.0.0.1:${addr.port}`;

    // 1. Seed interactive demo library
    const seedRes = await fetch(`${base}/api/demo/seed`, { method: "POST" });
    assert.equal(seedRes.status, 200);
    const seedData = (await seedRes.json()) as { trackersCount: number; tracksCount: number };
    assert.equal(seedData.trackersCount, 2);
    assert.equal(seedData.tracksCount, 10);

    // 2. Profile get & update
    const putProf = await fetch(`${base}/api/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Julia", bio: "Lossless collector", accentColor: "#ec4899" }),
    });
    assert.equal(putProf.status, 200);
    const profRes = await fetch(`${base}/api/profile`);
    const profJson = (await profRes.json()) as {
      profile: { name: string; accentColor: string };
      stats: { likedCount: number; playlistCount: number; trackerCount: number };
    };
    assert.equal(profJson.profile.name, "Julia");
    assert.equal(profJson.profile.accentColor, "#ec4899");
    assert.equal(profJson.stats.trackerCount, 2);
    assert.ok(profJson.stats.likedCount >= 4);

    // 3. Toggle like
    const unlikeRes = await fetch(`${base}/api/likes/demo_trk_01`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liked: false }),
    });
    assert.equal(((await unlikeRes.json()) as { liked: boolean }).liked, false);
    const relikeRes = await fetch(`${base}/api/likes/demo_trk_01`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liked: true }),
    });
    assert.equal(((await relikeRes.json()) as { liked: boolean }).liked, true);

    // 4. Playlist create -> add -> reorder -> remove -> delete
    const createPl = await fetch(`${base}/api/playlists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Session Mix", description: "Unit test mix" }),
    });
    assert.equal(createPl.status, 201);
    const { playlist } = (await createPl.json()) as { playlist: { id: string; name: string } };

    await fetch(`${base}/api/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: "demo_trk_01" }),
    });
    await fetch(`${base}/api/playlists/${playlist.id}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId: "demo_trk_02" }),
    });
    await fetch(`${base}/api/playlists/${playlist.id}/tracks/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackIds: ["demo_trk_02", "demo_trk_01"] }),
    });

    const detailRes = await fetch(`${base}/api/playlists/${playlist.id}`);
    const detailJson = (await detailRes.json()) as { playlist: { tracks: Array<{ id: string }> } };
    assert.deepEqual(
      detailJson.playlist.tracks.map((t) => t.id),
      ["demo_trk_02", "demo_trk_01"]
    );

    await fetch(`${base}/api/playlists/${playlist.id}/tracks/demo_trk_02`, { method: "DELETE" });
    const afterRm = (await (await fetch(`${base}/api/playlists/${playlist.id}`)).json()) as {
      playlist: { tracks: Array<{ id: string }> };
    };
    assert.deepEqual(
      afterRm.playlist.tracks.map((t) => t.id),
      ["demo_trk_01"]
    );

    const delPl = await fetch(`${base}/api/playlists/${playlist.id}`, { method: "DELETE" });
    assert.equal(delPl.status, 200);

    // 5. Recent searches add & clear
    await fetch(`${base}/api/recent-searches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Melbourne", itemType: "query" }),
    });
    const rsList = (await (await fetch(`${base}/api/recent-searches`)).json()) as {
      items: Array<{ query: string }>;
    };
    assert.equal(rsList.items[0]!.query, "Melbourne");
    await fetch(`${base}/api/recent-searches`, { method: "DELETE" });
    const rsCleared = (await (await fetch(`${base}/api/recent-searches`)).json()) as { items: unknown[] };
    assert.equal(rsCleared.items.length, 0);

    // 6. Real HTTP 206 Byte-Range stream + progressive cache on a demo track
    const streamRes = await fetch(`${base}/api/tracks/demo_trk_01/stream`, {
      headers: { Range: "bytes=0-4095" },
    });
    assert.equal(streamRes.status, 206);
    assert.equal(streamRes.headers.get("content-type"), "audio/wav");
    const chunk = Buffer.from(await streamRes.arrayBuffer());
    assert.equal(chunk.length, 4096);
    assert.equal(chunk.subarray(0, 4).toString("ascii"), "RIFF");

    // Second request hits progressive disk cache
    const cachedHitRes = await fetch(`${base}/api/tracks/demo_trk_01/stream`, {
      headers: { Range: "bytes=0-1023" },
    });
    assert.equal(cachedHitRes.status, 206);
    assert.equal(cachedHitRes.headers.get("x-cache-status"), "HIT");

    // 7. Demo SVG art endpoint returns crisp SVG
    const artRes = await fetch(`${base}/api/demo/art/after-hours-sessions`);
    assert.equal(artRes.status, 200);
    assert.ok(artRes.headers.get("content-type")?.includes("image/svg+xml"));
    const svg = await artRes.text();
    assert.ok(svg.includes("<svg"));

    // 8. Activity notification endpoint & read state
    const actBefore = (await (await fetch(`${base}/api/activity`)).json()) as { unreadCount: number };
    assert.ok(actBefore.unreadCount >= 1);
    await fetch(`${base}/api/activity/read`, { method: "POST" });
    const actAfter = (await (await fetch(`${base}/api/activity`)).json()) as { unreadCount: number };
    assert.equal(actAfter.unreadCount, 0);

    // Verify demo payload helper cleanly builds deterministic structure
    assert.equal(buildDemoSeedPayload().trackers.length, 2);
  });
});
