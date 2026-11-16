import '../styles/video/kala.css';
import './skin.css';
import './icons';
import '@videojs/html/i18n';
import '@videojs/html/ui/container';
import '@videojs/html/ui/poster';
import '@videojs/html/ui/error-dialog';
import '@videojs/html/ui/dialog-backdrop';
import '@videojs/html/ui/dialog-popup';
import '@videojs/html/ui/dialog-title';
import '@videojs/html/ui/dialog-description';
import '@videojs/html/ui/dialog-close';
import '@videojs/html/ui/controls';
import '@videojs/html/ui/controls-backdrop';
import '@videojs/html/ui/controls-group';
import '@videojs/html/ui/buffering-indicator';
import '@videojs/html/ui/controls-content';
import '@videojs/html/ui/tooltip-group';
import '@videojs/html/ui/title';
import '@videojs/html/ui/airplay-button';
import '@videojs/html/ui/tooltip';
import '@videojs/html/ui/tooltip-label';
import '@videojs/html/ui/tooltip-shortcut';
import '@videojs/html/ui/cast-button';
import '@videojs/html/ui/pip-button';
import '@videojs/html/ui/fullscreen-button';
import '@videojs/html/ui/seek-button';
import '@videojs/html/ui/play-button';
import '@videojs/html/ui/time-slider';
import '@videojs/html/ui/time-slider-chapters';
import '@videojs/html/ui/slider-track';
import '@videojs/html/ui/slider-buffer';
import '@videojs/html/ui/slider-fill';
import '@videojs/html/ui/slider-thumb';
import '@videojs/html/ui/slider-preview';
import '@videojs/html/ui/slider-thumbnail';
import '@videojs/html/ui/slider-value';
import '@videojs/html/ui/time-slider-chapter-title';
import '@videojs/html/ui/mute-button';
import '@videojs/html/ui/volume-slider';
import '@videojs/html/ui/time-group';
import '@videojs/html/ui/time';
import '@videojs/html/ui/time-separator';
import '@videojs/html/ui/captions-button';
import '@videojs/html/ui/menu';
import '@videojs/html/ui/menu-content';
import '@videojs/html/ui/menu-item';
import '@videojs/html/ui/menu-separator';
import '@videojs/html/ui/quality-radio-group';
import '@videojs/html/ui/menu-radio-item';
import '@videojs/html/ui/menu-item-indicator';
import '@videojs/html/ui/audio-track-radio-group';
import '@videojs/html/ui/playback-rate-radio-group';
import '@videojs/html/ui/captions-radio-group';
import '@videojs/html/ui/hotkey';
import '@videojs/html/ui/gesture';
import '@videojs/html/ui/status-announcer';
import '@videojs/html/ui/volume-indicator';
import '@videojs/html/ui/volume-indicator-fill';
import '@videojs/html/ui/volume-indicator-value';
import '@videojs/html/ui/status-indicator';
import '@videojs/html/ui/status-indicator-value';
import '@videojs/html/ui/seek-indicator';
import '@videojs/html/ui/seek-indicator-value';

/**
 * Kala-only behaviour, wired per player instance (call after the skin markup
 * is in the DOM): the keyboard-shortcuts dialog and the live chapter line
 * under the title. Everything else is declarative Video.js components.
 */
export function enhanceKalaPlayer(player: HTMLElement, chaptersUrl?: string): void {
  const container = player.querySelector('media-container');
  if (!container) return;
  wireKeyboardDialog(container as HTMLElement);
  wireChapterLabel(container as HTMLElement, chaptersUrl);
}

function wireKeyboardDialog(container: HTMLElement): void {
  const dialog = container.querySelector('.kala-kbd-dialog') as HTMLElement | null;
  const trigger = container.querySelector('.kala-keyboard-button') as HTMLElement | null;
  const closeBtn = container.querySelector('[data-kala-kbd-close]') as HTMLElement | null;
  if (!dialog || !trigger || !closeBtn) return;

  const hotkeys = Array.from(container.querySelectorAll('media-hotkey'));
  let lastFocus: HTMLElement | null = null;

  const open = (): void => {
    lastFocus = document.activeElement as HTMLElement | null;
    // While the guide is open, player hotkeys stay out of the way.
    hotkeys.forEach((h) => h.setAttribute('disabled', ''));
    dialog.removeAttribute('hidden');
    closeBtn.focus();
  };

  const close = (): void => {
    dialog.setAttribute('hidden', '');
    hotkeys.forEach((h) => h.removeAttribute('disabled'));
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  };

  trigger.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  container.addEventListener('keydown', (event) => {
    if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      if (dialog.hasAttribute('hidden')) open();
      else close();
    } else if (event.key === 'Escape' && !dialog.hasAttribute('hidden')) {
      event.preventDefault();
      close();
    }
  });
}

interface ChapterCue {
  start: number;
  end: number;
  text: string;
}

function wireChapterLabel(container: HTMLElement, chaptersUrl?: string): void {
  const label = container.querySelector('.kala-chapter-label') as HTMLElement | null;
  const media = container.querySelector('mux-video, video') as unknown as HTMLVideoElement | null;
  if (!label || !media) return;

  let cues: ChapterCue[] | null = null;

  const render = (time: number): void => {
    if (!cues) return;
    const index = cues.findIndex((c) => time >= c.start && time < c.end);
    label.textContent =
      index >= 0 ? `Ch ${String(index + 1).padStart(2, '0')} · ${cues[index].text}` : '';
  };

  // Path 1: read the chapters track the media element already parsed.
  const readTrack = (): boolean => {
    try {
      const tracks = media.textTracks;
      if (!tracks) return false;
      for (const track of Array.from(tracks)) {
        if (track.kind === 'chapters' && track.cues && track.cues.length > 0) {
          cues = Array.from(track.cues).map((c) => ({
            start: c.startTime,
            end: c.endTime,
            text: (c as VTTCue).text,
          }));
          render(media.currentTime || 0);
          return true;
        }
      }
    } catch {
      /* fall through to the VTT fetch */
    }
    return false;
  };

  // Path 2: fetch and parse the chapters file directly (some media components
  // keep their text tracks out of reach from the light DOM).
  const fetchChapters = async (): Promise<void> => {
    if (!chaptersUrl || cues) return;
    try {
      const text = await (await fetch(chaptersUrl)).text();
      const parsed: ChapterCue[] = [];
      const blocks = text.split(/\n\s*\n/);
      for (const block of blocks) {
        const match = block.match(
          /(\d+:)?(\d+):(\d+\.\d+)\s+-->\s+(\d+:)?(\d+):(\d+\.\d+)\s*\n([\s\S]*)/,
        );
        if (!match) continue;
        const toSeconds = (h: string | undefined, m: string, s: string): number =>
          (h ? parseInt(h, 10) * 3600 : 0) + parseInt(m, 10) * 60 + parseFloat(s);
        parsed.push({
          start: toSeconds(match[1], match[2], match[3]),
          end: toSeconds(match[4], match[5], match[6]),
          text: match[7].trim().replace(/\s+/g, ' '),
        });
      }
      if (parsed.length > 0) {
        cues = parsed;
        render(media.currentTime || 0);
      }
    } catch {
      /* No chapter line — the slider still shows chapter titles on hover. */
    }
  };

  const onTime = (): void => render(media.currentTime || 0);
  media.addEventListener('timeupdate', onTime);
  media.addEventListener('loadedmetadata', () => {
    if (!readTrack()) void fetchChapters();
  });
  // The track may already be loaded by the time this runs.
  if (!readTrack()) void fetchChapters();
}
