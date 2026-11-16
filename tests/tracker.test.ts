import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractArtTabCovers, extractTrackerId, normalizeTrackerPayload, parseArtistsCsv } from "../src/tracker.ts";

describe("tracker normalization & ID extraction", () => {
  it("extracts 44-char IDs from raw strings, Google Sheets URLs, and ArtistGrid URLs", () => {
    const id = "1i4OQglDHiiqMDthqfUFPutGmpZzK7n63LaoWApqhQXI";
    assert.equal(extractTrackerId(id), id);
    assert.equal(
      extractTrackerId(`https://docs.google.com/spreadsheets/d/${id}/edit?gid=123#gid=123`),
      id
    );
    assert.equal(extractTrackerId(`https://artistgrid.cx/view?tracker=${id}`), id);
    assert.equal(extractTrackerId("franktracker.net"), "franktracker.net");
    assert.throws(() => extractTrackerId("not-a-tracker"));
  });

  it("normalizes v3 grouped responses and ranks playable lossless links ahead of YouTube", () => {
    const v3 = {
      name: "Kendrick Lamar Music Tracker",
      tab: { name: "🎵 Unreleased", slug: "main", gid: "1169728352" },
      tabs: [{ name: "🎵 Unreleased", slug: "main", gid: "1169728352" }],
      eras: [
        {
          name: "Section.80",
          color: "#4B5320",
          cover_art: "https://example.com/s80.jpg",
          tracks: [
            {
              name: {
                raw: "Demo Song\n(prod. Sounwave)",
                title: "Demo Song",
                credits: ["(prod. Sounwave)"],
              },
              notes: "Recorded in 2011 studio session.",
              quality: "Lossless",
              sub_era: "Studio Sessions",
              links: [
                { url: "https://www.youtube.com/watch?v=abc123" },
                { url: "https://pillowcase.su/f/0833bf042e6c8cf1666bf1f7fbe55f2e" },
              ],
            },
            {
              name: { raw: "???", title: "???" },
              notes: "Interview mention only",
              quality: "Not Available",
              links: [{ url: "https://example.com/interview.html" }],
            },
          ],
        },
      ],
    };

    const res = normalizeTrackerPayload("1i4OQglDHiiqMDthqfUFPutGmpZzK7n63LaoWApqhQXI", v3);
    assert.equal(res.tracker.artistName, "Kendrick Lamar");
    assert.equal(res.erasCount, 1);
    assert.equal(res.tracks.length, 2);

    const t0 = res.tracks[0]!;
    assert.equal(t0.title, "Demo Song");
    assert.equal(t0.credits, "(prod. Sounwave)");
    assert.equal(t0.primaryHost, "pillows");
    assert.equal(t0.primaryUrl, "https://pillows.su/f/0833bf042e6c8cf1666bf1f7fbe55f2e");
    assert.equal(t0.isPlayable, true);
    assert.equal(t0.formatHint, "lossless");
    assert.equal(t0.links.length, 2);

    const t1 = res.tracks[1]!;
    assert.equal(t1.isPlayable, false);
  });

  it("normalizes legacy v2 tracker payloads", () => {
    const v2 = {
      name: "Test Artist Tracker",
      tabs: ["Unreleased"],
      current_tab: "Unreleased",
      eras: {
        era1: {
          name: "Early Era",
          data: {
            Default: [
              {
                name: "Track One",
                quality: "https://pixeldrain.com/u/AbCdEf12",
                notes: "Legacy URL in quality column",
              },
            ],
          },
        },
      },
    };

    const res = normalizeTrackerPayload("12nGHPPh5dVTfLuBLVQYzC3QgPxKfvp-jgCoNccvEasM", v2);
    assert.equal(res.tracks.length, 1);
    assert.equal(res.tracks[0]!.primaryHost, "pixeldrain");
    assert.equal(res.tracks[0]!.primaryUrl, "https://pixeldrain.com/u/AbCdEf12");
    assert.equal(res.tracks[0]!.quality, "");
  });

  it("parses ArtistGrid CSV directory with quoted commas and alt suffixes", () => {
    const csv = `\uFEFFname,url,credit,links_work,updated,best
"Kanye West",12nGHPPh5dVTfLuBLVQYzC3QgPxKfvp-jgCoNccvEasM,"Nicole, Edideaur",1,1,true
"Kanye West",https://docs.google.com/spreadsheets/d/1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI/edit,"Alt",1,0,false`;

    const artists = parseArtistsCsv(csv);
    assert.equal(artists.length, 2);
    assert.equal(artists[0]!.name, "Kanye West");
    assert.equal(artists[0]!.isStarred, true);
    assert.equal(artists[1]!.name, "Kanye West [Alt]");
    assert.equal(artists[1]!.trackerId, "1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI");
  });

  it("extracts permanent Front Cover URLs from Art tab payload", () => {
    const artPayload = {
      eras: [
        {
          name: "Training Day",
          tracks: [
            {
              name: { title: "Training Day [Back]" },
              type: "Back Cover",
              links: [{ url: "https://i.ibb.co/back/back.jpg" }],
            },
            {
              name: { title: "Training Day" },
              type: "Front Cover",
              art_used: true,
              links: [{ url: "https://i.ibb.co/4McYcND/Training-Day.jpg" }],
            },
          ],
        },
        {
          name: "Bad Link Era",
          tracks: [
            {
              name: { title: "Trailer" },
              links: [{ url: "https://www.youtube.com/watch?v=123" }],
            },
          ],
        },
      ],
    };

    const covers = extractArtTabCovers(artPayload);
    assert.equal(covers.get("training day"), "https://i.ibb.co/4McYcND/Training-Day.jpg");
    assert.equal(covers.get("bad link era"), undefined);
  });
});
