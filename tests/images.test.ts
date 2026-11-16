import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { isAllowedPublicImageUrl, resolveCoverImageUrl } from "../src/images.ts";
import { createAppServer } from "../src/server.ts";

describe("cover art image proxy & resolver", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const d of tempDirs.splice(0)) {
      await fsp.rm(d, { recursive: true, force: true });
    }
  });

  it("blocks private/loopback URLs (SSRF guard) and allows public HTTPS URLs", () => {
    assert.equal(isAllowedPublicImageUrl("http://127.0.0.1:8080/x.png"), false);
    assert.equal(isAllowedPublicImageUrl("http://192.168.1.1/x.png"), false);
    assert.equal(isAllowedPublicImageUrl("http://localhost/x.png"), false);
    assert.equal(isAllowedPublicImageUrl("file:///C:/secret.txt"), false);
    assert.equal(
      isAllowedPublicImageUrl("https://docs.google.com/sheets-images-rt/ADdU-test=w16383"),
      true
    );
  });

  it("resolves ibb.co, imgur.com, and legacy mzstatic URLs to direct image URLs", async () => {
    const imgur = await resolveCoverImageUrl("https://imgur.com/AbCd123");
    assert.equal(imgur, "https://i.imgur.com/AbCd123.jpg");

    const mz = await resolveCoverImageUrl(
      "https://a1.mzstatic.com/r40/Music122/v4/f9/58/95/f95895f4-0ef6-a636-241e-ba4824ef6621/17UMGIM08349.rgb.jpg"
    );
    assert.equal(
      mz,
      "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/f9/58/95/f95895f4-0ef6-a636-241e-ba4824ef6621/17UMGIM08349.rgb.jpg/600x600bb.jpg"
    );

    const ibb = await resolveCoverImageUrl("https://ibb.co/XYZ999", async () =>
      new Response(JSON.stringify({ url: "https://i.ibb.co/XYZ999/cover.png" }), { status: 200 })
    );
    assert.equal(ibb, "https://i.ibb.co/XYZ999/cover.png");
  });

  it("proxies & caches cover art on disk without forwarding Referer", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "vaultstream-img-"));
    tempDirs.push(tmp);

    let upstreamCalls = 0;
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const app = createAppServer({
      dbPath: path.join(tmp, "test.db"),
      cacheDir: path.join(tmp, "cache"),
      imagesDir: path.join(tmp, "images"),
      fetchImpl: async (_url, init) => {
        upstreamCalls++;
        const hdrs = new Headers(init?.headers);
        assert.equal(hdrs.get("referer"), null);
        return new Response(pngBytes, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      },
    });

    await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const addr = app.server.address();
    assert.ok(addr && typeof addr === "object");
    const base = `http://127.0.0.1:${addr.port}`;

    try {
      const target = encodeURIComponent("https://docs.google.com/sheets-images-rt/test-img=w16383");
      const r1 = await fetch(`${base}/api/image?url=${target}`);
      assert.equal(r1.status, 200);
      assert.equal(r1.headers.get("content-type"), "image/png");
      assert.equal(r1.headers.get("x-image-cache"), "MISS");
      assert.deepEqual(new Uint8Array(await r1.arrayBuffer()), pngBytes);
      assert.equal(upstreamCalls, 1);

      const r2 = await fetch(`${base}/api/image?url=${target}`);
      assert.equal(r2.status, 200);
      assert.equal(r2.headers.get("x-image-cache"), "HIT");
      assert.equal(upstreamCalls, 1);

      // Verify iTunes album art fallback when primary Google URL returns 403
      const expired = encodeURIComponent("https://docs.google.com/sheets-images-rt/expired=w16383");
      const appWithFallback = createAppServer({
        dbPath: path.join(tmp, "test2.db"),
        cacheDir: path.join(tmp, "cache2"),
        imagesDir: path.join(tmp, "images2"),
        fetchImpl: async (url) => {
          if (url.includes("docs.google.com")) {
            return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/html" } });
          }
          if (url.startsWith("https://itunes.apple.com/search")) {
            return new Response(
              JSON.stringify({
                results: [
                  {
                    artistName: "Kendrick Lamar",
                    collectionName: "Section.80",
                    artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg",
                  },
                ],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            );
          }
          if (url.includes("mzstatic.com") && url.includes("600x600bb")) {
            return new Response(pngBytes, { status: 200, headers: { "Content-Type": "image/jpeg" } });
          }
          return new Response("Not found", { status: 404 });
        },
      });
      await new Promise<void>((resolve) => appWithFallback.server.listen(0, "127.0.0.1", resolve));
      const fbAddr = appWithFallback.server.address();
      assert.ok(fbAddr && typeof fbAddr === "object");
      try {
        const fbRes = await fetch(
          `http://127.0.0.1:${fbAddr.port}/api/image?url=${expired}&artist=Kendrick+Lamar&era=Section.80`
        );
        assert.equal(fbRes.status, 200);
        assert.equal(fbRes.headers.get("content-type"), "image/jpeg");
      } finally {
        await appWithFallback.close();
      }
    } finally {
      await app.close();
    }
  });
});
