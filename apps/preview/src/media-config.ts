// What the demo plays. One file owns every video source so the Mux swap is one line.
//
// ── MUX BONUS (worth +1 point) ──────────────────────────────────────────────
// 1. Upload `apps/preview/public/footage/daylight-earth.mp4` (NASA, public
//    domain) to Mux as a public asset with static renditions enabled.
// 2. Paste its public playback ID into MUX_PLAYBACK_ID below.
// 3. Set DEFAULT_FOOTAGE to 'daylight-mux' (or leave 'cosmic-dawn' — the
//    footage switcher on the demo page will offer the Mux stream either way).
// The player must keep playing that Mux video, and the asset must stay live
// while the challenge is judged.

/** Public playback ID of OUR Mux asset (empty until the upload is done). */
export const MUX_PLAYBACK_ID = 'vZP00W02N75fyj6ggx3nXshMRBCqMSAi8NZQiJN602ndwo';

export interface Footage {
  id: string;
  /** Short label shown in the footage switcher. */
  label: string;
  /** One-line description for the demo page. */
  description: string;
  /** 'mux' = HLS via Mux; 'mp4' = plain progressive MP4. */
  kind: 'mux' | 'mp4';
  /** Playback ID (mux) or URL (mp4). */
  src: string;
  poster: string;
  /** Chapters track (relative URL), served from `apps/preview/public`. */
  chapters?: string;
  /** Title shown in the player's title block (`content-title`). */
  title: string;
  /** True when the footage is predominantly bright — used by the demo page to
   *  invite the contrast check (controls must stay readable on bright video). */
  bright?: boolean;
}

export const FOOTAGE: Record<string, Footage> = {
  'cosmic-dawn': {
    id: 'cosmic-dawn',
    label: 'Cosmic Dawn',
    description: 'The James Webb story — archival NASA footage, dark and bright scenes.',
    kind: 'mux',
    // Video.js scaffold demo asset (public Mux playback ID). Kept as the default
    // because it ships HLS renditions (Quality menu) and chapter cues.
    src: '83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s',
    poster: 'https://image.mux.com/83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s/thumbnail.webp?time=69',
    chapters: './cosmic-dawn-chapters.vtt',
    title: 'Cosmic Dawn — The Voyage to Webb',
  },
  daylight: {
    id: 'daylight',
    label: 'Daylight',
    description: 'Earth from the ISS, Expedition 65 — bright daylight footage (NASA, public domain).',
    kind: 'mp4',
    src: './footage/daylight-earth.mp4',
    poster: './footage/daylight-earth-poster.jpg',
    chapters: './footage/daylight-earth-chapters.vtt',
    title: 'Earth from Space — Expedition 65',
    bright: true,
  },
  // Enabled automatically once MUX_PLAYBACK_ID is set: the same NASA clip,
  // served from our own Mux asset. This is the stream the Mux bonus point
  // requires the player to play.
  'daylight-mux': {
    id: 'daylight-mux',
    label: 'Daylight · Mux',
    description: 'The same NASA clip, streamed from our Mux asset.',
    kind: 'mux',
    src: MUX_PLAYBACK_ID,
    poster: './footage/daylight-earth-poster.jpg',
    chapters: './footage/daylight-earth-chapters.vtt',
    title: 'Earth from Space — Expedition 65',
    bright: true,
  },
};

/** Footage the demo opens with. */
export const DEFAULT_FOOTAGE = 'daylight-mux';

/** Footage offered in the demo page switcher (the Mux entry appears only when configured). */
export function availableFootage(): Footage[] {
  return Object.values(FOOTAGE).filter((f) => f.kind !== 'mux' || f.src !== '');
}
