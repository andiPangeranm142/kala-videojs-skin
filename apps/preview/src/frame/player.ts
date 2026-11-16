import '@videojs/html/video/player';
import '@videojs/html/media/mux-video';
import '@/video/skin';
import { enhanceKalaPlayer } from '@/video/skin';
import skinTemplate from '@/video/skin.html?raw';
import { DEFAULT_FOOTAGE, FOOTAGE, type Footage } from '../media-config';

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';

function mediaMarkup(footage: Footage): string {
  const chapters = footage.chapters
    ? `<track kind="chapters" label="English" srclang="en" src="${footage.chapters}" default>`
    : '';
  if (footage.kind === 'mux') {
    return `<mux-video src="https://stream.mux.com/${footage.src}.m3u8" playsinline crossorigin>${chapters}</mux-video>`;
  }
  return `<video src="${footage.src}" playsinline crossorigin preload="metadata">${chapters}</video>`;
}

/** Build a Kala player for the given footage (defaults to the configured default). */
export function createPlayer(footage: Footage = FOOTAGE[DEFAULT_FOOTAGE]): HTMLElement {
  const player = document.createElement('video-player');
  player.setAttribute('poster', footage.poster);
  player.setAttribute('content-title', footage.title);

  player.innerHTML = skinTemplate.replace(MEDIA_PLACEHOLDER, mediaMarkup(footage));
  enhanceKalaPlayer(player, footage.chapters);
  return player;
}
