import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { checkForUpdates, findGitExecutable, getCurrentCommit } from "../src/updater.ts";

describe("GitHub auto-updater", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const d of tempDirs.splice(0)) {
      await fsp.rm(d, { recursive: true, force: true });
    }
  });

  it("discovers a git executable path and reads current commit", async () => {
    const gitBin = findGitExecutable();
    assert.ok(typeof gitBin === "string" && gitBin.length > 0);
    const commit = await getCurrentCommit(process.cwd());
    assert.ok(typeof commit === "string" && commit.length >= 7);
  });

  it("reports unsupported cleanly when directory is not a git repo", async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "vaultstream-nogit-"));
    tempDirs.push(tmp);
    const status = await checkForUpdates(tmp);
    assert.equal(status.supported, false);
    assert.equal(status.behindCount, 0);
  });
});
