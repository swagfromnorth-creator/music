import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface UpdateStatus {
  supported: boolean;
  reason?: string;
  localCommit?: string;
  remoteCommit?: string;
  behindCount: number;
  commits: string[];
  dirty: boolean;
  autoUpdateEnabled?: boolean;
  lastCheckedAt?: number;
  lastError?: string | null;
}

export interface UpdateApplyResult {
  updated: boolean;
  previousCommit: string;
  currentCommit: string;
  changedFiles: string[];
  needsServerRestart: boolean;
  summary: string;
  installedDeps: boolean;
}

export function findGitExecutable(): string | null {
  const candidates: string[] = [];

  if (process.platform === "win32") {
    const localApp = process.env.LOCALAPPDATA ?? "";
    if (localApp) {
      try {
        const pkgRoot = path.join(localApp, "Microsoft", "WinGet", "Packages");
        if (fs.existsSync(pkgRoot)) {
          for (const dir of fs.readdirSync(pkgRoot)) {
            if (dir.startsWith("Git.MinGit") || dir.startsWith("Git.Git")) {
              candidates.push(path.join(pkgRoot, dir, "cmd", "git.exe"));
            }
          }
        }
      } catch {
        // ignore scan error
      }
      candidates.push(path.join(localApp, "Programs", "Git", "cmd", "git.exe"));
    }
    candidates.push("C:\\Program Files\\Git\\cmd\\git.exe");
    candidates.push("C:\\Program Files (x86)\\Git\\cmd\\git.exe");
    candidates.push(
      "C:\\Program Files\\Microsoft Visual Studio\\18\\Community\\Common7\\IDE\\CommonExtensions\\Microsoft\\TeamFoundation\\Team Explorer\\Git\\cmd\\git.exe"
    );
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return "git";
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  const gitBin = findGitExecutable() ?? "git";
  const { stdout } = await execFileAsync(gitBin, args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    timeout: 20000,
  });
  return stdout.trim();
}

export async function getCurrentCommit(cwd = process.cwd()): Promise<string | null> {
  if (!fs.existsSync(path.join(cwd, ".git"))) return null;
  try {
    return await runGit(cwd, ["rev-parse", "--short", "HEAD"]);
  } catch {
    return null;
  }
}

export async function checkForUpdates(cwd = process.cwd()): Promise<UpdateStatus> {
  if (!fs.existsSync(path.join(cwd, ".git"))) {
    return { supported: false, reason: "Not a Git repository.", behindCount: 0, commits: [], dirty: false };
  }

  try {
    await runGit(cwd, ["fetch", "origin", "main", "--quiet"]);
    const localCommit = await runGit(cwd, ["rev-parse", "--short", "HEAD"]);
    const remoteCommit = await runGit(cwd, ["rev-parse", "--short", "origin/main"]);
    const behindRaw = await runGit(cwd, ["rev-list", "--count", "HEAD..origin/main"]);
    const behindCount = Number(behindRaw) || 0;
    const commitsRaw =
      behindCount > 0 ? await runGit(cwd, ["log", "--oneline", "-n", "10", "HEAD..origin/main"]) : "";
    const statusOut = await runGit(cwd, ["status", "--porcelain"]);

    return {
      supported: true,
      localCommit,
      remoteCommit,
      behindCount,
      commits: commitsRaw ? commitsRaw.split(/\r?\n/).filter(Boolean) : [],
      dirty: statusOut.length > 0,
    };
  } catch (err) {
    return {
      supported: false,
      reason: err instanceof Error ? err.message : "Could not check GitHub updates.",
      behindCount: 0,
      commits: [],
      dirty: false,
    };
  }
}

export async function applyGitUpdate(cwd = process.cwd()): Promise<UpdateApplyResult> {
  if (!fs.existsSync(path.join(cwd, ".git"))) {
    throw new Error("Workspace is not a Git repository.");
  }

  const branch = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch.toLowerCase() !== "main") {
    throw new Error(`Auto-update only runs on 'main' branch (current: '${branch}').`);
  }

  const previousCommit = await runGit(cwd, ["rev-parse", "--short", "HEAD"]);
  let pullOut = "";

  try {
    pullOut = await runGit(cwd, ["pull", "--rebase", "--autostash", "origin", "main"]);
  } catch (err) {
    // Abort incomplete rebase if a conflict occurred so repo stays usable
    try {
      await runGit(cwd, ["rebase", "--abort"]);
    } catch {
      // ignore if not in rebase
    }
    throw err;
  }

  const currentCommit = await runGit(cwd, ["rev-parse", "--short", "HEAD"]);
  const updated = previousCommit !== currentCommit;

  let changedFiles: string[] = [];
  let installedDeps = false;
  if (updated) {
    try {
      const diffOut = await runGit(cwd, ["diff", "--name-only", previousCommit, currentCommit]);
      changedFiles = diffOut.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (changedFiles.some((f) => /^package(?:-lock)?\.json$/i.test(f))) {
        const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
        await execFileAsync(npmCmd, ["install"], { cwd, timeout: 60000 });
        installedDeps = true;
      }
    } catch {
      // non-fatal if diff/install skipped
    }
  }

  const needsServerRestart =
    updated &&
    changedFiles.some((f) => f.startsWith("src/") || /^package(?:-lock)?\.json$/i.test(f));

  return {
    updated,
    previousCommit,
    currentCommit,
    changedFiles,
    needsServerRestart,
    summary: pullOut,
    installedDeps,
  };
}
