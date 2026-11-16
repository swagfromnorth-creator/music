import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectHost, resolveHostUrl, type FetchLike } from "../src/resolver.ts";

describe("host link detection & resolution", () => {
  it("detects supported hosts and normalizes pillowcase.su", () => {
    assert.equal(detectHost("https://pixeldrain.com/u/Tto4zYkf"), "pixeldrain");
    assert.equal(detectHost("https://pillowcase.su/f/0833bf042e6c8cf1666bf1f7fbe55f2e"), "pillows");
    assert.equal(detectHost("https://music.froste.lol/song/abc123"), "froste");
    assert.equal(detectHost("https://krakenfiles.com/view/xyz999/file.html"), "krakenfiles");
    assert.equal(detectHost("https://soundcloud.com/artist/track-slug"), "soundcloud");
    assert.equal(detectHost("https://cdn.example.com/audio/master.flac"), "direct");
    assert.equal(detectHost("https://www.youtube.com/watch?v=123"), "youtube");
  });

  it("resolves Pixeldrain /u/<id> to /api/file/<id> with metadata", async () => {
    const mockFetch: FetchLike = async (url) => {
      assert.equal(url, "https://pixeldrain.com/api/file/TestId12/info");
      return new Response(
        JSON.stringify({
          name: "Demo_Master.flac",
          mime_type: "audio/flac",
          size: 42100000,
          availability: "",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const res = await resolveHostUrl("https://pixeldrain.com/u/TestId12", mockFetch);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.resolvedUrl, "https://pixeldrain.com/api/file/TestId12");
      assert.equal(res.filename, "Demo_Master.flac");
      assert.equal(res.mimeType, "audio/flac");
      assert.equal(res.sizeBytes, 42100000);
      assert.equal(res.formatHint, "flac");
    }
  });

  it("reports Pixeldrain captcha rate-limit cleanly without bypassing", async () => {
    const mockFetch: FetchLike = async () =>
      new Response(
        JSON.stringify({
          availability: "file_rate_limited_captcha_required",
          availability_message: "Hotlinking requires subscription or verification",
        }),
        { status: 200 }
      );

    const res = await resolveHostUrl("https://pixeldrain.com/u/RateLim1", mockFetch);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.errorCode, "rate_limited_captcha");
    }
  });

  it("resolves Pillows, Froste, SoundCloud, KrakenFiles, Imgur, Tidal, and Qobuz", async () => {
    const pillows = await resolveHostUrl("https://pillowcase.su/f/0833bf042e6c8cf1666bf1f7fbe55f2e");
    assert.equal(pillows.ok, true);
    if (pillows.ok) {
      assert.equal(pillows.resolvedUrl, "https://api.pillows.su/api/download/0833bf042e6c8cf1666bf1f7fbe55f2e");
    }

    const froste = await resolveHostUrl("https://music.froste.lol/song/deadbeef");
    assert.equal(froste.ok, true);
    if (froste.ok) {
      assert.equal(froste.resolvedUrl, "https://music.froste.lol/song/deadbeef/download");
    }

    const sc = await resolveHostUrl("https://soundcloud.com/kdot/unreleased-snippet");
    assert.equal(sc.ok, true);
    if (sc.ok) {
      assert.equal(sc.resolvedUrl, "https://sc.maid.zone/_/restream/kdot/unreleased-snippet");
    }

    const krakenFetch: FetchLike = async () =>
      new Response(`<script>player({ m4a: '//s4.krakenfiles.com/get/abc/track.m4a' })</script>`, {
        status: 200,
      });
    const kraken = await resolveHostUrl("https://krakenfiles.com/view/abc123/file.html", krakenFetch);
    assert.equal(kraken.ok, true);
    if (kraken.ok) {
      assert.equal(kraken.resolvedUrl, "https://s4.krakenfiles.com/get/abc/track.m4a");
    }

    const imgurFetch: FetchLike = async () =>
      new Response(JSON.stringify({ cdnUrl: "https://cdn.imgur.gg/track.flac", mediaType: "audio/flac" }), {
        status: 200,
      });
    const imgur = await resolveHostUrl("https://imgur.gg/f/xyz789", imgurFetch);
    assert.equal(imgur.ok, true);
    if (imgur.ok) {
      assert.equal(imgur.resolvedUrl, "https://cdn.imgur.gg/track.flac");
    }

    const manifestB64 = Buffer.from(
      JSON.stringify({ mimeType: "audio/flac", urls: ["https://tidal-cdn.example/song.flac"] })
    ).toString("base64");
    const tidalFetch: FetchLike = async () =>
      new Response(JSON.stringify({ data: { manifest: manifestB64 } }), { status: 200 });
    const tidal = await resolveHostUrl("https://tidal.com/browse/track/998877", tidalFetch);
    assert.equal(tidal.ok, true);
    if (tidal.ok) {
      assert.equal(tidal.resolvedUrl, "https://tidal-cdn.example/song.flac");
    }

    const qobuzFetch: FetchLike = async () =>
      new Response(JSON.stringify({ data: { url: "https://qobuz-cdn.example/master.flac" } }), {
        status: 200,
      });
    const qobuz = await resolveHostUrl("https://open.qobuz.com/track/554433", qobuzFetch);
    assert.equal(qobuz.ok, true);
    if (qobuz.ok) {
      assert.equal(qobuz.resolvedUrl, "https://qobuz-cdn.example/master.flac");
    }
  });
});
