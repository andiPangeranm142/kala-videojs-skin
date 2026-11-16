# KALA — Submission description

## Post text for the Contra form (copy verbatim)

> **KALA — An Observatory Player.** A Video.js v10 skin for the videos you watch in the dark. *Kala* is Sanskrit & Indonesian for "time" — so the timeline became a horizon: the Night Arc seek bar carries an aurora gradient, twinkling chapter stars, and a glowing moon thumb, while the Eclipse play button breathes a halo until you press play. Three live skies (Midnight, Aurora, Ember) re-tint the whole player, the floating glass console keeps every control readable over bright launch footage and black space alike, and the full keyboard guide is one `?` away. Built for slow cinema, space documentaries, and night-sky films — the kind of video you watch with the lights off. Live demo: https://andipangeranm142.github.io/kala-videojs-skin/
>
> #videojsskinschallenge

## Design thinking (longer version, if the form allows more)

Most players are neutral chrome. Kala picks a niche — the night-sky film — and commits to it, so every detail has a reason to exist. The timeline is a horizon line because an observatory measures the night by it; chapters are stars because they are the moments worth navigating by; progress is an aurora because the videos this player is for end with one. The type system pairs Fraunces (a display serif for the title) with Inter and IBM Plex Mono (for time and chapter labels), and the custom 18×18 "kala" icon set keeps every glyph on the same grid. Nothing is decoration for its own sake: the hover card on the seek bar shows a live storyboard thumbnail, time, and chapter; the volume slider unfurls from the mute button; the settings menu carries real HLS quality levels, audio tracks, speed, and captions; and the keyboard guide documents 20+ shortcuts that all actually work. Accessibility was designed in, not bolted on: 44px touch targets, an amber focus ring with a dark halo that reads on any frame, ARIA labels and live announcements, and full `prefers-reduced-motion`, high-contrast, and forced-colors support. The skin was tested against two videos — dark (Cosmic Dawn) and bright (Daylight, Earth from the ISS) — to prove the controls hold contrast over both.

## Submission facts

- **Live demo (Project URL + Live-site URL):** https://andipangeranm142.github.io/kala-videojs-skin/
- **Player-only view:** https://andipangeranm142.github.io/kala-videojs-skin/preview.html
- **Repository:** https://github.com/andiPangeranm142/kala-videojs-skin
- **Mux playback ID:** _to be added after the Daylight upload — see `apps/preview/src/media-config.ts`_
- **License:** Apache 2.0 (ownership stays with the participant)
- **Media:** `assets/submission/` — screenshots (1600×1200) + demo video
