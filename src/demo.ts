import type { TrackerRecord, TrackRecord } from "./types.ts";

export interface DemoSeedPayload {
  trackers: Array<{
    tracker: Omit<TrackerRecord, "syncedTabs" | "lastSyncedAt">;
    tracks: TrackRecord[];
  }>;
  likedTrackIds: string[];
  followedTrackerIds: string[];
  playlists: Array<{
    name: string;
    description: string;
    coverGradient: string;
    trackIds: string[];
  }>;
  recentSearches: Array<{
    query: string;
    itemType: "query" | "track" | "artist" | "era";
    itemId?: string;
    subtitle: string;
    imageUrl?: string;
  }>;
}

const DEMO_CHORD_PROFILES: Record<
  string,
  { tempo: number; chords: number[][]; padGain: number; bassMul: number }
> = {
  "midnight-velvet": {
    tempo: 88,
    chords: [
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [196.0, 246.94, 293.66, 349.23], // G7
      [164.81, 196.0, 246.94, 329.63], // Em7
    ],
    padGain: 0.24,
    bassMul: 0.5,
  },
  "neon-horizon": {
    tempo: 108,
    chords: [
      [261.63, 311.13, 392.0, 466.16], // Cm7
      [207.65, 261.63, 311.13, 392.0], // Abmaj7
      [233.08, 293.66, 349.23, 415.3], // Bb7
      [196.0, 233.08, 293.66, 349.23], // Gm7
    ],
    padGain: 0.22,
    bassMul: 0.5,
  },
  "chrome-echo": {
    tempo: 96,
    chords: [
      [293.66, 349.23, 440.0, 523.25], // Dm7
      [233.08, 293.66, 349.23, 440.0], // Bbmaj7
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0], // Am7
    ],
    padGain: 0.22,
    bassMul: 0.5,
  },
  "solstice-tape": {
    tempo: 78,
    chords: [
      [246.94, 293.66, 369.99, 440.0], // Bm7
      [196.0, 246.94, 293.66, 369.99], // Gmaj7
      [220.0, 277.18, 329.63, 415.3], // Amaj7
      [185.0, 220.0, 277.18, 329.63], // F#m7
    ],
    padGain: 0.25,
    bassMul: 0.5,
  },
};

const wavBufferCache = new Map<string, Buffer>();

export function generateDemoWavBuffer(slug: string): Buffer {
  const cached = wavBufferCache.get(slug);
  if (cached) return cached;

  const profileKey =
    Object.keys(DEMO_CHORD_PROFILES).find((k) => slug.includes(k)) ?? "midnight-velvet";
  const profile = DEMO_CHORD_PROFILES[profileKey]!;

  // Deterministic pitch shift per unique track slug so every track has its own signature harmony
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
  const semitoneShift = ((Math.abs(hash) % 7) - 3) * 0.5;
  const pitchFactor = Math.pow(2, semitoneShift / 12);

  const sampleRate = 44100;
  const channels = 2;
  const bitsPerSample = 16;
  const durationSec = 14;
  const numSamples = sampleRate * durationSec;
  const dataSize = numSamples * channels * (bitsPerSample / 8);

  const buf = Buffer.allocUnsafe(44 + dataSize);
  // RIFF WAVE header
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // PCM fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buf.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);

  const chordDur = durationSec / profile.chords.length;
  const beatDur = 60 / profile.tempo;

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.min(profile.chords.length - 1, Math.floor(t / chordDur));
    const chordLocal = t - chordIdx * chordDur;
    const chord = profile.chords[chordIdx]!;

    // Smooth chord envelope
    const attack = Math.min(1, chordLocal / 0.14);
    const release = Math.min(1, Math.max(0, (chordDur - chordLocal) / 0.25));
    const env = attack * (0.65 + 0.35 * Math.exp(-chordLocal * 0.7)) * release;

    // Gentle pulse/arpeggio modulation
    const beatPhase = (t % beatDur) / beatDur;
    const pulse = 0.85 + 0.15 * Math.exp(-beatPhase * 5);
    const arpNote = chord[Math.floor(t / (beatDur * 0.5)) % chord.length]! * 2 * pitchFactor;
    const arpLocal = t % (beatDur * 0.5);
    const arpEnv = Math.exp(-arpLocal * 7.5) * 0.14;

    let left = 0;
    let right = 0;

    // Warm electric piano / pad voices with slight stereo detune
    for (let n = 0; n < chord.length; n++) {
      const f = chord[n]! * pitchFactor;
      const pan = n % 2 === 0 ? 0.62 : 0.38;
      const tone =
        Math.sin(2 * Math.PI * f * t) * 0.72 +
        Math.sin(2 * Math.PI * f * 2 * t) * 0.18 * Math.exp(-chordLocal * 1.4) +
        Math.sin(2 * Math.PI * (f + 0.35) * t) * 0.1;
      left += tone * pan;
      right += tone * (1 - pan);
    }

    // Sub-warm bass root
    const bassF = chord[0]! * profile.bassMul * pitchFactor;
    const bass = Math.sin(2 * Math.PI * bassF * t) * 0.32 * pulse;

    // Soft stereo bell arpeggio
    const arpSig = Math.sin(2 * Math.PI * arpNote * t) * arpEnv;
    const arpPan = 0.5 + 0.35 * Math.sin(t * 1.2);

    // Master fade in/out
    const masterFade = Math.min(1, t / 0.35) * Math.min(1, Math.max(0, (durationSec - t) / 0.75));

    const lSample = Math.tanh((left * env * profile.padGain + bass + arpSig * arpPan) * masterFade * 1.25);
    const rSample = Math.tanh(
      (right * env * profile.padGain + bass + arpSig * (1 - arpPan)) * masterFade * 1.25
    );

    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(lSample * 31000))), offset);
    buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(rSample * 31000))), offset + 2);
    offset += 4;
  }

  wavBufferCache.set(slug, buf);
  return buf;
}

export function createDemoAudioResponse(slug: string, rangeHeader?: string | null): Response {
  const buf = generateDemoWavBuffer(slug);
  const total = buf.length;

  if (rangeHeader) {
    const match = rangeHeader.trim().match(/^bytes=(\d*)-(\d*)$/i);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(total - 1, Number(match[2])) : total - 1;
      if (start >= 0 && start <= end && start < total) {
        const slice = buf.subarray(start, end + 1);
        return new Response(new Uint8Array(slice), {
          status: 206,
          headers: {
            "Content-Type": "audio/wav",
            "Accept-Ranges": "bytes",
            "Content-Length": String(slice.length),
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Content-Disposition": `inline; filename="${slug}.wav"`,
          },
        });
      }
    }
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Accept-Ranges": "bytes",
      "Content-Length": String(total),
      "Content-Disposition": `inline; filename="${slug}.wav"`,
    },
  });
}

interface ArtTheme {
  bg1: string;
  bg2: string;
  glow1: string;
  glow2: string;
  accent: string;
  shape: "rings" | "prism" | "horizon" | "aurora" | "vinyl" | "waves";
}

const DEMO_ART_THEMES: Record<string, ArtTheme> = {
  "after-hours-sessions": {
    bg1: "#14061f",
    bg2: "#09040e",
    glow1: "#9333ea",
    glow2: "#ec4899",
    accent: "#c084fc",
    shape: "aurora",
  },
  "velvet-tapes": {
    bg1: "#1f0814",
    bg2: "#0a0409",
    glow1: "#e11d48",
    glow2: "#7c3aed",
    accent: "#fb7185",
    shape: "vinyl",
  },
  "chrome-solstice": {
    bg1: "#071422",
    bg2: "#040812",
    glow1: "#2563eb",
    glow2: "#06b6d4",
    accent: "#60a5fa",
    shape: "prism",
  },
  "midnight-telemetry": {
    bg1: "#061b18",
    bg2: "#040b0a",
    glow1: "#10b981",
    glow2: "#0ea5e9",
    accent: "#34d399",
    shape: "waves",
  },
  "amber-archive": {
    bg1: "#221307",
    bg2: "#0d0804",
    glow1: "#f59e0b",
    glow2: "#ef4444",
    accent: "#fbbf24",
    shape: "horizon",
  },
  "quiet-hours": {
    bg1: "#101228",
    bg2: "#070812",
    glow1: "#6366f1",
    glow2: "#a855f7",
    accent: "#818cf8",
    shape: "rings",
  },
  "nova-hero": {
    bg1: "#26081a",
    bg2: "#080612",
    glow1: "#ef4444",
    glow2: "#7c4dff",
    accent: "#f43f5e",
    shape: "aurora",
  },
  "kai-hero": {
    bg1: "#081a2b",
    bg2: "#05070e",
    glow1: "#06b6d4",
    glow2: "#6366f1",
    accent: "#38bdf8",
    shape: "prism",
  },
};

export function renderDemoArtSvg(slug: string): string {
  const theme = DEMO_ART_THEMES[slug] ?? DEMO_ART_THEMES["after-hours-sessions"]!;
  let motif = "";

  if (theme.shape === "rings") {
    motif = `
      <circle cx="300" cy="300" r="210" fill="none" stroke="${theme.accent}" stroke-opacity="0.22" stroke-width="2"/>
      <circle cx="300" cy="300" r="155" fill="none" stroke="${theme.accent}" stroke-opacity="0.34" stroke-width="2.5"/>
      <circle cx="300" cy="300" r="98" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.5"/>
      <circle cx="300" cy="300" r="40" fill="${theme.glow1}" fill-opacity="0.55"/>
    `;
  } else if (theme.shape === "prism") {
    motif = `
      <polygon points="300,85 500,455 100,455" fill="none" stroke="${theme.accent}" stroke-opacity="0.45" stroke-width="3"/>
      <polygon points="300,145 450,425 150,425" fill="${theme.glow1}" fill-opacity="0.18" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>
      <line x1="60" y1="320" x2="540" y2="235" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2"/>
    `;
  } else if (theme.shape === "horizon") {
    motif = `
      <circle cx="300" cy="275" r="115" fill="url(#g2)" opacity="0.82"/>
      <rect x="0" y="320" width="600" height="280" fill="${theme.bg2}" fill-opacity="0.72"/>
      <line x1="60" y1="340" x2="540" y2="340" stroke="${theme.accent}" stroke-opacity="0.45" stroke-width="2"/>
      <line x1="110" y1="368" x2="490" y2="368" stroke="${theme.accent}" stroke-opacity="0.3" stroke-width="2"/>
      <line x1="165" y1="396" x2="435" y2="396" stroke="${theme.accent}" stroke-opacity="0.2" stroke-width="2"/>
    `;
  } else if (theme.shape === "vinyl") {
    motif = `
      <circle cx="300" cy="300" r="205" fill="#09090d" fill-opacity="0.75" stroke="${theme.accent}" stroke-opacity="0.28" stroke-width="2"/>
      <circle cx="300" cy="300" r="165" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>
      <circle cx="300" cy="300" r="128" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="1"/>
      <circle cx="300" cy="300" r="76" fill="url(#g2)" fill-opacity="0.88"/>
      <circle cx="300" cy="300" r="16" fill="#07070a"/>
    `;
  } else if (theme.shape === "waves") {
    motif = `
      <path d="M0 320 Q150 220 300 320 T600 320" fill="none" stroke="${theme.accent}" stroke-opacity="0.55" stroke-width="3"/>
      <path d="M0 360 Q150 260 300 360 T600 360" fill="none" stroke="${theme.glow2}" stroke-opacity="0.4" stroke-width="2.5"/>
      <path d="M0 400 Q150 300 300 400 T600 400" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>
    `;
  } else {
    motif = `
      <path d="M-40 420 C120 260 280 500 440 280 C520 170 590 210 640 160 L640 620 L-40 620 Z" fill="url(#g2)" fill-opacity="0.34"/>
      <circle cx="430" cy="180" r="145" fill="${theme.glow2}" fill-opacity="0.26"/>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${theme.bg1}"/>
        <stop offset="100%" stop-color="${theme.bg2}"/>
      </linearGradient>
      <radialGradient id="g1" cx="28%" cy="24%" r="65%">
        <stop offset="0%" stop-color="${theme.glow1}" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="${theme.glow1}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g2" cx="76%" cy="72%" r="60%">
        <stop offset="0%" stop-color="${theme.glow2}" stop-opacity="0.65"/>
        <stop offset="100%" stop-color="${theme.glow2}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="600" height="600" fill="url(#bg)"/>
    <rect width="600" height="600" fill="url(#g1)"/>
    <rect width="600" height="600" fill="url(#g2)"/>
    ${motif}
  </svg>`;
}

function makeDemoTrack(spec: {
  id: string;
  trackerId: string;
  tabName: string;
  artist: string;
  title: string;
  credits?: string;
  era: string;
  eraOrder: number;
  trackOrder: number;
  eraColor: string;
  artSlug: string;
  audioSlug: string;
  quality: string;
  length: string;
  leakDate: string;
  notes: string;
}): TrackRecord {
  const demoUrl = `demo://${spec.audioSlug}.wav`;
  return {
    id: spec.id,
    trackerId: spec.trackerId,
    tabName: spec.tabName,
    title: spec.title,
    rawName: spec.title,
    credits: spec.credits ?? "",
    artist: spec.artist,
    era: spec.era,
    subEra: "Studio Session",
    eraOrder: spec.eraOrder,
    trackOrder: spec.trackOrder,
    eraColor: spec.eraColor,
    eraTextColor: "#ffffff",
    eraImage: `/api/demo/art/${spec.artSlug}`,
    notes: spec.notes,
    quality: spec.quality,
    formatHint: "wav",
    trackLength: spec.length,
    availableLength: "Full",
    leakDate: spec.leakDate,
    fileDate: spec.leakDate,
    trackType: "Lossless Master",
    primaryUrl: demoUrl,
    primaryHost: "direct",
    links: [
      {
        url: demoUrl,
        text: "Lossless Studio Master (WAV 44.1kHz)",
        host: "direct",
        playable: true,
        formatHint: "wav",
      },
    ],
    resolvedUrl: demoUrl,
    resolvedMime: "audio/wav",
    resolvedSize: null,
    resolvedFilename: `${spec.audioSlug}.wav`,
    resolvedAt: Date.now(),
    isPlayable: true,
    audioMeta: {
      codec: "WAV",
      sampleRateHz: 44100,
      bitsPerSample: 16,
      channels: 2,
      durationSec: 14,
      lossless: true,
    },
  };
}

export function buildDemoSeedPayload(): DemoSeedPayload {
  const novaId = "demo_nova_vance_vault";
  const kaiId = "demo_kai_solstice_vault";

  const novaTracks: TrackRecord[] = [
    makeDemoTrack({
      id: "demo_trk_01",
      trackerId: novaId,
      tabName: "Unreleased",
      artist: "Nova Vance",
      title: "Melbourne Sunset",
      credits: "(prod. Arca & Sounwave)",
      era: "After Hours Sessions",
      eraOrder: 0,
      trackOrder: 0,
      eraColor: "#5b21b6",
      artSlug: "after-hours-sessions",
      audioSlug: "midnight-velvet-melbourne",
      quality: "Lossless · Studio Bounce",
      length: "0:14",
      leakDate: "2026-04-12",
      notes: "Tagless 16-bit lossless master straight from Studio B analog tape transfer. Warm electric piano chords with stereo chorus shimmer.",
    }),
    makeDemoTrack({
      id: "demo_trk_02",
      trackerId: novaId,
      tabName: "Unreleased",
      artist: "Nova Vance",
      title: "Every Day [V2 Mix]",
      credits: "(prod. Kaytranada)",
      era: "After Hours Sessions",
      eraOrder: 0,
      trackOrder: 1,
      eraColor: "#5b21b6",
      artSlug: "after-hours-sessions",
      audioSlug: "midnight-velvet-everyday",
      quality: "Lossless · CDQ",
      length: "0:14",
      leakDate: "2026-03-28",
      notes: "Alternate second bounce recorded late at Electric Lady Studios with extended synth outro.",
    }),
    makeDemoTrack({
      id: "demo_trk_03",
      trackerId: novaId,
      tabName: "Unreleased",
      artist: "Nova Vance",
      title: "Forever",
      credits: "(feat. Sarah)",
      era: "Velvet Tapes",
      eraOrder: 1,
      trackOrder: 0,
      eraColor: "#9f1239",
      artSlug: "velvet-tapes",
      audioSlug: "neon-horizon-forever",
      quality: "Lossless · 44.1kHz",
      length: "0:14",
      leakDate: "2025-11-19",
      notes: "Original collaboration demo featuring Sarah's atmospheric harmonies before final tracklist cut.",
    }),
    makeDemoTrack({
      id: "demo_trk_04",
      trackerId: novaId,
      tabName: "Unreleased",
      artist: "Nova Vance",
      title: "Neon Static",
      credits: "(feat. Kai Solstice)",
      era: "Velvet Tapes",
      eraOrder: 1,
      trackOrder: 1,
      eraColor: "#9f1239",
      artSlug: "velvet-tapes",
      audioSlug: "neon-horizon-static",
      quality: "Lossless · Master",
      length: "0:14",
      leakDate: "2025-10-04",
      notes: "Late-night analog modular jam bounced uncompressed for vinyl test pressing.",
    }),
    makeDemoTrack({
      id: "demo_trk_05",
      trackerId: novaId,
      tabName: "Unreleased",
      artist: "Nova Vance",
      title: "Glass Elevator",
      credits: "(prod. Vegyn)",
      era: "Quiet Hours",
      eraOrder: 2,
      trackOrder: 0,
      eraColor: "#3730a3",
      artSlug: "quiet-hours",
      audioSlug: "solstice-tape-glass",
      quality: "Lossless · Studio WAV",
      length: "0:14",
      leakDate: "2025-07-22",
      notes: "Sparse nocturnal interlude recorded on a vintage Prophet-5.",
    }),
    makeDemoTrack({
      id: "demo_trk_06",
      trackerId: novaId,
      tabName: "Unreleased",
      artist: "Nova Vance",
      title: "Amber Skyline",
      credits: "(feat. Marie)",
      era: "Amber Archive",
      eraOrder: 3,
      trackOrder: 0,
      eraColor: "#92400e",
      artSlug: "amber-archive",
      audioSlug: "chrome-echo-amber",
      quality: "Lossless · CDQ",
      length: "0:14",
      leakDate: "2025-02-14",
      notes: "Early demo from the Amber Archive sessions with warm tape saturation.",
    }),
  ];

  const kaiTracks: TrackRecord[] = [
    makeDemoTrack({
      id: "demo_trk_07",
      trackerId: kaiId,
      tabName: "Unreleased",
      artist: "Kai Solstice",
      title: "Chrome Echoes",
      credits: "(prod. Flume)",
      era: "Chrome Solstice",
      eraOrder: 0,
      trackOrder: 0,
      eraColor: "#1d4ed8",
      artSlug: "chrome-solstice",
      audioSlug: "chrome-echo-chrome",
      quality: "Lossless · Master",
      length: "0:14",
      leakDate: "2026-05-03",
      notes: "Uncompressed club-ready master bounce from Tokyo tour hotel sessions.",
    }),
    makeDemoTrack({
      id: "demo_trk_08",
      trackerId: kaiId,
      tabName: "Unreleased",
      artist: "Kai Solstice",
      title: "3000 Days [OG Mix]",
      credits: "(feat. Nova Vance)",
      era: "Chrome Solstice",
      eraOrder: 0,
      trackOrder: 1,
      eraColor: "#1d4ed8",
      artSlug: "chrome-solstice",
      audioSlug: "neon-horizon-3000days",
      quality: "Lossless · Studio WAV",
      length: "0:14",
      leakDate: "2026-01-17",
      notes: "Original pre-album version with shimmering polyphonic arpeggios.",
    }),
    makeDemoTrack({
      id: "demo_trk_09",
      trackerId: kaiId,
      tabName: "Unreleased",
      artist: "Kai Solstice",
      title: "Telemetry Rain",
      credits: "(prod. Four Tet)",
      era: "Midnight Telemetry",
      eraOrder: 1,
      trackOrder: 0,
      eraColor: "#047857",
      artSlug: "midnight-telemetry",
      audioSlug: "solstice-tape-telemetry",
      quality: "Lossless · 44.1kHz",
      length: "0:14",
      leakDate: "2025-09-09",
      notes: "Ambient deep-focus session recorded live in one take.",
    }),
    makeDemoTrack({
      id: "demo_trk_10",
      trackerId: kaiId,
      tabName: "Unreleased",
      artist: "Kai Solstice",
      title: "Subzero Drift",
      credits: "(prod. Hudson Mohawke)",
      era: "Midnight Telemetry",
      eraOrder: 1,
      trackOrder: 1,
      eraColor: "#047857",
      artSlug: "midnight-telemetry",
      audioSlug: "midnight-velvet-subzero",
      quality: "Lossless · CDQ",
      length: "0:14",
      leakDate: "2025-06-30",
      notes: "Deep late-night synth sketch with warm sub-bass resonance.",
    }),
  ];

  return {
    trackers: [
      {
        tracker: {
          trackerId: novaId,
          name: "Nova Vance Studio Vault",
          artistName: "Nova Vance",
          currentTab: "Unreleased",
          tabs: [{ name: "Unreleased", slug: "unreleased", gid: "0" }],
          trackCount: novaTracks.length,
          playableCount: novaTracks.length,
          credits: "VaultStream Interactive Demo Showcase",
        },
        tracks: novaTracks,
      },
      {
        tracker: {
          trackerId: kaiId,
          name: "Kai Solstice Studio Vault",
          artistName: "Kai Solstice",
          currentTab: "Unreleased",
          tabs: [{ name: "Unreleased", slug: "unreleased", gid: "0" }],
          trackCount: kaiTracks.length,
          playableCount: kaiTracks.length,
          credits: "VaultStream Interactive Demo Showcase",
        },
        tracks: kaiTracks,
      },
    ],
    likedTrackIds: ["demo_trk_01", "demo_trk_03", "demo_trk_07", "demo_trk_09"],
    followedTrackerIds: [novaId],
    playlists: [
      {
        name: "Art Techno & Nocturnes",
        description: "Late-night uncompressed studio bounces and analog synth sessions.",
        coverGradient: "linear-gradient(135deg, #7c3aed, #ec4899)",
        trackIds: ["demo_trk_01", "demo_trk_04", "demo_trk_07", "demo_trk_10"],
      },
      {
        name: "Quiet Hours",
        description: "Warm minimal lossless tracks for deep focus and midnight listening.",
        coverGradient: "linear-gradient(135deg, #1d4ed8, #0f766e)",
        trackIds: ["demo_trk_05", "demo_trk_09", "demo_trk_06"],
      },
      {
        name: "Velvet Vault",
        description: "Favorite rare collaborations and alternate V2 mixes.",
        coverGradient: "linear-gradient(135deg, #be123c, #581c87)",
        trackIds: ["demo_trk_02", "demo_trk_03", "demo_trk_08"],
      },
    ],
    recentSearches: [
      {
        query: "Nova Vance",
        itemType: "artist",
        itemId: novaId,
        subtitle: "Artist",
        imageUrl: "/api/demo/art/after-hours-sessions",
      },
      {
        query: "Kai Solstice",
        itemType: "artist",
        itemId: kaiId,
        subtitle: "Artist",
        imageUrl: "/api/demo/art/chrome-solstice",
      },
      {
        query: "Chrome Solstice",
        itemType: "era",
        itemId: kaiId,
        subtitle: "Era · Kai Solstice",
        imageUrl: "/api/demo/art/chrome-solstice",
      },
      {
        query: "Melbourne Sunset",
        itemType: "track",
        itemId: "demo_trk_01",
        subtitle: "Song · Nova Vance",
        imageUrl: "/api/demo/art/after-hours-sessions",
      },
    ],
  };
}
