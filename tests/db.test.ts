import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { AppDatabase, buildFtsMatchQuery } from "../src/db.ts";
import type { TrackRecord } from "../src/types.ts";

function makeTrack(idx: number, overrides: Partial<TrackRecord> = {}): TrackRecord {
  const era = idx % 2 === 0 ? "Section.80" : "Good Kid";
  const url = `https://pillows.su/f/${idx.toString(16).padStart(32, "0")}`;
  return {
    id: `trk_${idx}`,
    trackerId: "tracker_abc",
    tabName: "Unreleased",
    title: idx === 42 ? "Cali-Niggaz [V1]" : `Unreleased Track ${idx}`,
    rawName: `Unreleased Track ${idx}`,
    credits: idx === 42 ? "(feat. Jay Rock)" : "(prod. Sounwave)",
    artist: "Kendrick Lamar",
    era,
    subEra: "Default",
    eraOrder: idx % 2,
    trackOrder: idx,
    eraColor: "#112233",
    eraTextColor: "#ffffff",
    eraImage: null,
    notes: idx === 42 ? "DJ tagless lossless studio bounce." : `Session bounce #${idx}`,
    quality: idx % 3 === 0 ? "Lossless" : "High Quality",
    formatHint: idx % 3 === 0 ? "lossless" : null,
    trackLength: "3:42",
    availableLength: "Full",
    leakDate: "2024-01-01",
    fileDate: null,
    trackType: "Studio",
    primaryUrl: url,
    primaryHost: idx % 5 === 0 ? "pixeldrain" : "pillows",
    links: [
      {
        url,
        host: idx % 5 === 0 ? "pixeldrain" : "pillows",
        playable: true,
        formatHint: null,
      },
    ],
    resolvedUrl: null,
    resolvedMime: null,
    resolvedSize: null,
    resolvedFilename: null,
    resolvedAt: null,
    isPlayable: true,
    audioMeta: null,
    ...overrides,
  };
}

describe("SQLite FTS5 indexing & filtering", () => {
  let db: AppDatabase | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it("safely builds FTS5 queries including punctuation-only edge cases", () => {
    assert.deepEqual(buildFtsMatchQuery("Cali-Niggaz"), {
      ftsQuery: '"Cali"* "Niggaz"*',
      fallbackLike: null,
    });
    assert.deepEqual(buildFtsMatchQuery("???"), {
      ftsQuery: null,
      fallbackLike: "%???%",
    });
    assert.deepEqual(buildFtsMatchQuery('AND "test"'), {
      ftsQuery: '"AND"* "test"*',
      fallbackLike: null,
    });
  });

  it("indexes 1,200+ tracks and runs instant FTS5 search & era/lossless filters", () => {
    db = new AppDatabase(":memory:");
    const tracks: TrackRecord[] = [];
    for (let i = 0; i < 1200; i++) {
      tracks.push(makeTrack(i));
    }
    tracks.push(makeTrack(9999, { title: "???", notes: "Mystery snippet" }));

    db.upsertSyncedTracker(
      {
        trackerId: "tracker_abc",
        name: "Kendrick Lamar Tracker",
        artistName: "Kendrick Lamar",
        currentTab: "Unreleased",
        tabs: [{ name: "Unreleased", slug: "main", gid: "1" }],
        trackCount: tracks.length,
        playableCount: tracks.length,
        credits: "Editors",
      },
      tracks
    );

    const caliRes = db.searchTracks({ trackerId: "tracker_abc", q: "tagless" });
    assert.equal(caliRes.total, 1);
    assert.equal(caliRes.tracks[0]!.id, "trk_42");
    assert.ok(caliRes.queryMs < 100);

    const symRes = db.searchTracks({ trackerId: "tracker_abc", q: "???" });
    assert.equal(symRes.total, 1);
    assert.equal(symRes.tracks[0]!.id, "trk_9999");

    const eraLossless = db.searchTracks({
      trackerId: "tracker_abc",
      era: "Section.80",
      losslessOnly: true,
    });
    assert.ok(eraLossless.total > 150);
    assert.ok(eraLossless.tracks.every((t) => t.era === "Section.80" && t.quality === "Lossless"));
  });

  it("preserves resolved URLs across tracker re-syncs", () => {
    db = new AppDatabase(":memory:");
    const t0 = makeTrack(1);
    db.upsertSyncedTracker(
      {
        trackerId: "tracker_abc",
        name: "Test",
        artistName: "Test",
        currentTab: "Unreleased",
        tabs: [],
        trackCount: 1,
        playableCount: 1,
        credits: null,
      },
      [t0]
    );
    db.updateTrackResolution("trk_1", {
      resolvedUrl: "https://api.pillows.su/api/download/0001",
      resolvedMime: "audio/flac",
      resolvedSize: 55000000,
    });

    // Re-sync same tracker
    db.upsertSyncedTracker(
      {
        trackerId: "tracker_abc",
        name: "Test",
        artistName: "Test",
        currentTab: "Unreleased",
        tabs: [],
        trackCount: 1,
        playableCount: 1,
        credits: null,
      },
      [makeTrack(1, { notes: "Updated notes" })]
    );

    const reloaded = db.getTrackById("trk_1")!;
    assert.equal(reloaded.notes, "Updated notes");
    assert.equal(reloaded.resolvedUrl, "https://api.pillows.su/api/download/0001");
    assert.equal(reloaded.resolvedSize, 55000000);
  });
});
