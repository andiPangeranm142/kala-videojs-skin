/**
 * KALA showcase page: mounts the hero player (with live sky + footage
 * switching), the compact responsive player, the ambient glow, and the
 * starfield behind the page.
 */
import '@videojs/html/i18n';

import { createPlayer } from '../frame/player';
import {
  availableFootage,
  DEFAULT_FOOTAGE,
  FOOTAGE,
  type Footage,
} from '../media-config';
import './showcase.css';

type Sky = 'midnight' | 'aurora' | 'ember';

const SKY_NOTES: Record<Sky, string> = {
  midnight: 'Midnight — teal to violet to lantern amber, the default night.',
  aurora: 'Aurora — green fire over ice blue, for the polar shows.',
  ember: 'Ember — sunset amber into rose, dusk at the observatory.',
};

const stage = document.querySelector<HTMLElement>('#stage');
const heroMount = document.querySelector<HTMLElement>('#hero-player');
const compactMount = document.querySelector<HTMLElement>('#compact-player');
const footageNote = document.querySelector<HTMLElement>('#footage-note');
const ambientVideo = document.querySelector<HTMLVideoElement>('#ambient-video');

let currentSky: Sky = 'midnight';
let currentFootage: Footage = FOOTAGE[DEFAULT_FOOTAGE];

/** Re-tint every mounted player and the stage to the given sky. */
function applySky(sky: Sky): void {
  currentSky = sky;
  stage?.setAttribute('data-sky', sky);

  for (const container of document.querySelectorAll('media-container[data-sky]'))
    container.setAttribute('data-sky', sky);

  for (const button of document.querySelectorAll<HTMLButtonElement>('#sky-switcher button'))
    button.setAttribute('aria-pressed', String(button.dataset.sky === sky));

  document.body.dataset.sky = sky;
  updateFootageNote();
}

/** Describe the current footage + sky under the stage. */
function updateFootageNote(): void {
  if (!footageNote) return;

  footageNote.textContent = `Now showing: ${currentFootage.title} — ${currentFootage.description} ${SKY_NOTES[currentSky]}`;
}

/** Rebuild the hero player for a different footage, keeping the current sky. */
function setFootage(id: string): void {
  if (!heroMount) return;

  currentFootage = FOOTAGE[id];

  const i18n = heroMount.querySelector('media-i18n');
  const next = createPlayer(currentFootage);
  next.querySelector('media-container')?.setAttribute('data-sky', currentSky);

  if (i18n) i18n.replaceChildren(next);
  else {
    const wrapper = document.createElement('media-i18n');
    wrapper.append(next);
    heroMount.replaceChildren(wrapper);
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('#footage-switcher button'))
    button.setAttribute('aria-pressed', String(button.dataset.footage === id));

  updateFootageNote();
}

/** Mount the hero + compact players once. */
function mount(): void {
  if (heroMount) {
    const i18n = document.createElement('media-i18n');
    i18n.append(createPlayer(currentFootage));
    heroMount.append(i18n);
  }

  if (compactMount) {
    const i18n = document.createElement('media-i18n');
    const compact = createPlayer(FOOTAGE.daylight);
    compact.setAttribute('data-player-size', 'compact');
    i18n.append(compact);
    compactMount.append(i18n);
  }

  updateFootageNote();
}

/** Wire the sky, footage, and ambient controls. */
function wireControls(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-sky]'))
    button.addEventListener('click', () => applySky(button.dataset.sky as Sky));

  for (const card of document.querySelectorAll<HTMLButtonElement>('[data-sky-target]'))
    card.addEventListener('click', () => {
      applySky(card.dataset.skyTarget as Sky);
      document.querySelector('#stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

  // Hide footage entries that are not configured (e.g. the Mux upload, until
  // a playback ID is set in media-config.ts).
  const available = new Set(availableFootage().map((footage) => footage.id));

  for (const button of document.querySelectorAll<HTMLButtonElement>('#footage-switcher button')) {
    if (!available.has(button.dataset.footage ?? '')) button.hidden = true;
    button.addEventListener('click', () => setFootage(button.dataset.footage ?? ''));
  }

  // Sync the initial pressed state with the footage the player actually
  // opened with (DEFAULT_FOOTAGE), so the switcher can never disagree
  // with the loaded video.
  for (const button of document.querySelectorAll<HTMLButtonElement>('#footage-switcher button'))
    button.setAttribute('aria-pressed', String(button.dataset.footage === currentFootage.id));

  const ambientToggle = document.querySelector<HTMLButtonElement>('#ambient-toggle');

  if (ambientToggle && ambientVideo) {
    const setAmbient = (on: boolean): void => {
      stage?.classList.toggle('ambient-off', !on);
      ambientToggle.setAttribute('aria-pressed', String(on));
      ambientToggle.querySelector('.toggle-text')!.textContent = on ? 'On' : 'Off';

      if (on) void ambientVideo.play().catch(() => undefined);
      else ambientVideo.pause();
    };

    ambientToggle.addEventListener('click', () =>
      setAmbient(ambientToggle.getAttribute('aria-pressed') !== 'true'),
    );

    // The ambient video is decorative; start it quietly once it can play.
    if (ambientVideo.readyState >= 2) void ambientVideo.play().catch(() => undefined);
    else
      ambientVideo.addEventListener(
        'canplay',
        () => void ambientVideo.play().catch(() => undefined),
        { once: true },
      );
  }
}

/** A slow twinkling starfield on a fixed canvas; still when motion is reduced. */
function starfield(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#starfield');

  if (!canvas) return;

  const context = canvas.getContext('2d');

  if (!context) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  type Star = { x: number; y: number; r: number; base: number; speed: number; phase: number };

  let stars: Star[] = [];
  let width = 0;
  let height = 0;

  const seed = (): void => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    const count = Math.round((width * height) / 12000);

    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.4 + Math.random() * 1.1,
      base: 0.25 + Math.random() * 0.55,
      speed: 0.3 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
    }));
  };

  const draw = (time: number): void => {
    context.clearRect(0, 0, width, height);

    for (const star of stars) {
      const twinkle = reduced ? 0 : Math.sin(time / 1000 * star.speed + star.phase) * 0.25;

      context.globalAlpha = Math.max(0.05, star.base + twinkle);
      context.fillStyle = '#e2e8f0';
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
  };

  seed();

  if (reduced) {
    draw(0);
  } else {
    const frame = (time: number): void => {
      draw(time);
      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    seed();
    draw(0);
  });
}

mount();
wireControls();
starfield();
