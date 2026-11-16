import path from "node:path";

export const PORT = Number(process.env.PORT ?? 3456);
export const HOST = process.env.HOST ?? "127.0.0.1";

export const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR ?? "data");
export const DB_PATH = path.join(DATA_DIR, "tracker.db");
export const CACHE_DIR = path.resolve(process.cwd(), process.env.CACHE_DIR ?? "cache");

export const DEFAULT_MAX_CACHE_BYTES = Number(
  process.env.MAX_CACHE_BYTES ?? 2 * 1024 * 1024 * 1024 // 2 GB
);

export const ARTISTGRID_V3_API = "https://trackerapi.artistgrid.cx";
export const ARTISTGRID_V2_API = "http://trackerapi-2.artistgrid.cx";
export const ARTISTGRID_DIRECTORY_CSV = "https://artists.artistgrid.cx/artists.csv";

export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
