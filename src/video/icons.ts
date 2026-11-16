// KALA icon family — hand-drawn on the Video.js 18×18 grid.
// Stroke-based (1.5px, round caps/joins), `currentColor` throughout so icons
// inherit the control color. Play/pause are filled for a bolder read at small
// sizes; the spinner is an orbiting trio of dots, the skin's signature mark.
import { registerIcons } from '@videojs/html/icons';

const S = (inner: string, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" aria-hidden="true" viewBox="0 0 18 18" ${attrs}>${inner}</svg>`;

const stroke = 'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
const fill = 'fill="currentColor" stroke="none"';

export const kalaIcons = {
  play: S(`<path ${fill} d="M7 4.8v8.4c0 .7.8 1.2 1.4.8l6.4-4.2c.6-.4.6-1.2 0-1.6L8.4 4c-.6-.4-1.4.1-1.4.8z"/>`),
  pause: S(
    `<rect x="5" y="4" width="3" height="10" rx="1.2" ${fill}/><rect x="10" y="4" width="3" height="10" rx="1.2" ${fill}/>`,
  ),
  restart: S(
    `<g ${stroke}><path d="M15 9a6 6 0 1 1-1.76-4.24"/><path d="M15.2 2.8v2.9h-2.9"/></g>`,
  ),
  seek: S(
    `<g ${stroke}><path d="M4.5 13.5a6 6 0 1 1 1-8.2"/><path d="M15 2.5V6h-3.5"/></g>`,
  ),
  'volume-high': S(
    `<path ${fill} d="M2 7h2.8L9 3.8v10.4L4.8 11H2z"/><g ${stroke}><path d="M11.5 6.8a3.4 3.4 0 0 1 0 4.4"/><path d="M13.6 4.9a6.2 6.2 0 0 1 0 8.2"/></g>`,
  ),
  'volume-low': S(
    `<path ${fill} d="M2 7h2.8L9 3.8v10.4L4.8 11H2z"/><path ${stroke} d="M11.5 6.8a3.4 3.4 0 0 1 0 4.4"/>`,
  ),
  'volume-off': S(
    `<path ${fill} d="M2 7h2.8L9 3.8v10.4L4.8 11H2z"/><path ${stroke} d="M12 7l3.5 4M15.5 7L12 11"/>`,
  ),
  'fullscreen-enter': S(
    `<path ${stroke} d="M2.5 6V4a1.5 1.5 0 0 1 1.5-1.5h2M12 2.5h2A1.5 1.5 0 0 1 15.5 4v2M15.5 12v2a1.5 1.5 0 0 1-1.5 1.5h-2M6 15.5H4A1.5 1.5 0 0 1 2.5 14v-2"/>`,
  ),
  'fullscreen-exit': S(
    `<path ${stroke} d="M6 2.5V6H2.5M12 2.5V6h3.5M15.5 12v-3a1 1 0 0 0-1-1H12M6 15.5v-3.5a1 1 0 0 1 1-1h2.5"/>`,
  ),
  'pip-enter': S(
    `<rect x="2" y="3.5" width="14" height="11" rx="1.5" ${stroke}/><rect x="9.5" y="9" width="5" height="3.8" rx="0.8" ${stroke}/>`,
  ),
  'pip-exit': S(
    `<rect x="2" y="3.5" width="14" height="11" rx="1.5" ${stroke}/><rect x="9.5" y="9" width="5" height="3.8" rx="0.8" ${fill}/>`,
  ),
  'captions-off': S(
    `<rect x="1.8" y="3.5" width="14.4" height="11" rx="1.5" ${stroke}/><path ${stroke} d="M5 8h4.5M11 8h2M5 11.5h7"/>`,
  ),
  'captions-on': S(
    `<path ${fill} fill-rule="evenodd" d="M3.3 3.5h11.4A1.5 1.5 0 0 1 16.2 5v8a1.5 1.5 0 0 1-1.5 1.5H3.3A1.5 1.5 0 0 1 1.8 13V5a1.5 1.5 0 0 1 1.5-1.5zM5 7.2h4.2v1.6H5zM10.8 7.2H13v1.6h-2.2zM5 10.2h6.5v1.6H5z"/>`,
  ),
  gear: S(
    `<g ${stroke}><path d="M13.34 7.2L13.61 8.1L15.48 7.74L15.48 10.26L13.61 9.9L13.34 10.8L12.9 11.63L14.47 12.69L12.69 14.47L11.63 12.9L10.8 13.34L9.9 13.61L10.26 15.48L7.74 15.48L8.1 13.61L7.2 13.34L6.37 12.9L5.31 14.47L3.53 12.69L5.1 11.63L4.66 10.8L4.39 9.9L2.52 10.26L2.52 7.74L4.39 8.1L4.66 7.2L5.1 6.37L3.53 5.31L5.31 3.53L6.37 5.1L7.2 4.66L8.1 4.39L7.74 2.52L10.26 2.52L9.9 4.39L10.8 4.66L11.63 5.1L12.69 3.53L14.47 5.31L12.9 6.37L13.34 7.2Z"/><circle cx="9" cy="9" r="2.1"/></g>`,
  ),
  check: S(`<path ${stroke} d="M3.5 9.5l3.5 3.5 7.5-8"/>`),
  chevron: S(`<path ${stroke} d="M7 4.5 11.5 9 7 13.5"/>`),
  // Orbit spinner: three dots circling a faint ring. The animation token lets
  // `prefers-reduced-motion` stop it (see the preferences stylesheet).
  spinner: S(
    `<style>@keyframes kala-orbit-spin{to{transform:rotate(360deg)}}</style><circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-opacity=".25" stroke-width="1.2"/><g style="transform-box:view-box;transform-origin:center;animation:var(--media-spinner-animation, kala-orbit-spin 1.4s linear infinite)"><circle cx="9" cy="2.5" r="1.6" ${fill}/><circle cx="14.6" cy="12.2" r="1.1" ${fill} opacity=".65"/><circle cx="3.4" cy="12.2" r="1.1" ${fill} opacity=".65"/></g>`,
  ),
  switches: S(
    `<g ${stroke}><path d="M2.5 6h13M2.5 12h13"/></g><circle cx="7" cy="6" r="1.7" ${fill}/><circle cx="11.5" cy="12" r="1.7" ${fill}/>`,
  ),
  speech: S(`<path ${stroke} stroke-width="2.2" d="M5 12V8M9 14V4M13 11V7"/>`),
  speed: S(
    `<g ${stroke}><path d="M3 12.5a6 6 0 0 1 12 0"/><path d="M9 12.5 12 8.5"/></g><circle cx="9" cy="12.5" r="1.2" ${fill}/>`,
  ),
  quality: S(
    `<rect x="1.8" y="3.5" width="14.4" height="11" rx="1.5" ${stroke}/><path ${stroke} d="M5.5 7v4M5.5 9h2.5M8 7v4M11 7v4M11 7h2.5a2 2 0 0 1 0 4H11"/>`,
  ),
  'airplay-enter': S(
    `<rect x="2" y="2.5" width="14" height="9.5" rx="1.5" ${stroke}/><path ${fill} d="M6.5 15.5 9 12l2.5 3.5z"/>`,
  ),
  'airplay-exit': S(
    `<rect x="2" y="2.5" width="14" height="9.5" rx="1.5" ${fill}/><path ${stroke} d="M6.5 15.5 9 12l2.5 3.5z"/>`,
  ),
  'cast-enter': S(
    `<rect x="2" y="2" width="14" height="9" rx="1.5" ${stroke}/><g ${stroke}><path d="M3.5 14.5a2.8 2.8 0 0 1 2.8-2.8"/><path d="M3.5 16.8a5.1 5.1 0 0 1 5.1-5.1"/></g><circle cx="3.5" cy="14.5" r="1" ${fill}/>`,
  ),
  'cast-exit': S(
    `<rect x="2" y="2" width="14" height="9" rx="1.5" ${fill}/><g ${stroke}><path d="M3.5 14.5a2.8 2.8 0 0 1 2.8-2.8"/><path d="M3.5 16.8a5.1 5.1 0 0 1 5.1-5.1"/></g><circle cx="3.5" cy="14.5" r="1" ${fill}/>`,
  ),
  keyboard: S(
    `<rect x="1.5" y="4.5" width="15" height="9" rx="1.5" ${stroke}/><path ${stroke} stroke-width="1.6" d="M4.5 7.5h1.2M8 7.5h1.2M11.5 7.5h1.2M6 10.8h6"/>`,
  ),
  close: S(`<path ${stroke} d="M5 5l8 8M13 5l-8 8"/>`),
  sparkle: S(
    `<path ${fill} d="M9 2.5c.5 3.5 1.5 5.5 6.5 6.5-5 1-6 3-6.5 6.5-.5-3.5-1.5-5.5-6.5-6.5 5-1 6-3 6.5-6.5z"/>`,
  ),
};

registerIcons('kala', kalaIcons);
