/* Record the KALA demo video + submission screenshots (1600x1200, 4:3).
   - Video: Playwright records the viewport while the script drives the
     player (play, seek + preview, volume, settings, keyboard guide,
     fullscreen, captions), then ffmpeg converts to mp4.
   - Screenshots: player playing with controls, keyboard dialog, settings menu.
   Usage: node tools/record-demo.cjs <base-url> <out-dir> */
const { chromium } = require('/home/hatch/workspace/codegeist/video-recorder/node_modules/playwright');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || '/tmp/kala-media';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startForwarder(localPort = 3129) {
  const raw = process.env.https_proxy || process.env.HTTPS_PROXY || '';
  const u = new URL(raw);
  const target = await dns.lookup(u.hostname, { family: 6 });
  const server = net.createServer((client) => {
    const upstream = net.connect({ host: target.address, port: Number(u.port) || 3128 });
    client.pipe(upstream);
    upstream.pipe(client);
    const onErr = () => { client.destroy(); upstream.destroy(); };
    client.on('error', onErr);
    upstream.on('error', onErr);
  });
  await new Promise((resolve, reject) => {
    server.listen(localPort, '127.0.0.1', resolve);
    server.on('error', reject);
  });
  return server;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const forwarder = await startForwarder();
  const browser = await chromium.launch({
    proxy: { server: 'http://127.0.0.1:3129', bypass: 'localhost,127.0.0.1' },
    // The window must match the recording size, or the fullscreen segment is
    // captured at half size and padded with gray (seen in the first recording).
    args: ['--autoplay-policy=no-user-gesture-required', '--window-size=1600,1200'],
  });

  try {
    const t0 = Date.now();
    const ctx = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
      ignoreHTTPSErrors: true,
      recordVideo: { dir: path.join(OUT, 'raw-video'), size: { width: 1600, height: 1200 } },
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  pageerror:', e.message));

    await page.goto(`${BASE}/preview.html#width=1360`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('video-player', { timeout: 30000 });
    await page.waitForFunction(() => {
      const p = document.querySelector('video-player');
      const m = p?.querySelector('mux-video, video');
      const v = m?.tagName === 'VIDEO' ? m : m?.shadowRoot?.querySelector('video');
      return (v?.readyState || 0) >= 2;
    }, { timeout: 20000 }).catch(() => {});
    await sleep(800);

    // Wake the controls (they fade after a few seconds without pointer
    // activity, even when paused) before the poster shot.
    const container = page.locator('media-container');
    const cb = await container.boundingBox();
    await page.mouse.move(cb.x + cb.width * 0.25, cb.y + cb.height * 0.25);
    await sleep(500);

    // ── Shot 1 (submission): paused poster + Eclipse ─────────────────────
    await page.screenshot({ path: path.join(OUT, 'kala-poster-eclipse.png') });

    // ── Play ─────────────────────────────────────────────────────────────
    const tPlay = Date.now();
    await page.locator('.video-controls-center-play').click();
    await sleep(3500);

    // Hover the seek bar at ~60% (bright launch tile) to load the storyboard
    // and show the preview card; nudge the mouse again right before the shot
    // so the controls stay awake.
    const slider = page.locator('.media-time-slider');
    const sb = await slider.boundingBox();
    await page.mouse.move(sb.x + sb.width * 0.6, sb.y + sb.height / 2);
    await sleep(1800);
    await page.mouse.move(sb.x + sb.width * 0.6 + 1, sb.y + sb.height / 2);
    await sleep(400);

    // ── Shot 2 (submission): playing, controls + seek preview visible ────
    await page.screenshot({ path: path.join(OUT, 'kala-desktop-player.png') });

    // Seek to 60%.
    await page.mouse.click(sb.x + sb.width * 0.6, sb.y + sb.height / 2);
    await sleep(3000);

    // Volume: wake the controls first (they fade while the mouse is idle),
    // then hover the mute button to unfurl the slider, drag to ~30%.
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height - 60);
    await sleep(500);
    await page.locator('.kala-volume-group').hover();
    await sleep(900);
    const vol = page.locator('.media-volume-slider');
    const vb = await vol.boundingBox();
    await page.mouse.move(vb.x + vb.width * 0.3, vb.y + vb.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await sleep(1500);

    // Settings menu → hover the Speed row (opens its submenu). Wake the
    // controls again — the volume interaction was a while ago.
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height - 60);
    await sleep(500);
    await page.locator('.media-settings-button').click();
    await sleep(1200);
    await page.screenshot({ path: path.join(OUT, 'kala-settings-menu.png') });
    await page.locator('.media-menu-item', { hasText: 'Speed' }).first().hover();
    await sleep(1500);
    await page.screenshot({ path: path.join(OUT, 'kala-speed-menu.png') });
    await page.keyboard.press('Escape');
    await sleep(600);

    // Keyboard guide: click the player first so "?" reaches the hotkeys.
    await page.locator('media-container').click({ position: { x: 10, y: 10 } }).catch(() => {});
    await page.keyboard.press('?');
    await page.waitForFunction(() =>
      !document.querySelector('.kala-kbd-dialog')?.hasAttribute('hidden'), { timeout: 5000 }).catch(() => {});
    await sleep(800);
    await page.screenshot({ path: path.join(OUT, 'kala-keyboard-guide.png') });
    await sleep(1500);
    await page.keyboard.press('Escape');
    await sleep(600);

    // Captions on, then fullscreen.
    await page.keyboard.press('c');
    await sleep(1800);
    await page.keyboard.press('f');
    await sleep(3000);
    await page.keyboard.press('Escape');
    await sleep(1200);

    // Back to the start and pause on the Eclipse.
    await page.keyboard.press('Home');
    await sleep(1000);
    await page.locator('.kala-bar-play').click().catch(() => {});
    await sleep(1800);

    const videoPath = await page.video().path().catch(() => null);
    await ctx.close();
    console.log('raw video:', videoPath);

    // Convert to mp4 (H.264, yuv420p) — start ~1s before the play click so
    // the slow page load is cut out of the demo.
    if (videoPath && fs.existsSync(videoPath)) {
      const mp4 = path.join(OUT, 'kala-demo.mp4');
      const trim = Math.max(0, (tPlay - t0) / 1000 - 1);
      console.log('trimming first', trim.toFixed(1), 's');
      // Clean, player-friendly encode: CFR 25fps, keyframe every 2s, moov up
      // front. (The first encode's irregular GOP — keyframes up to ~6s apart
      // — stuttered badly on phones.)
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(trim), '-i', videoPath,
        '-vf', 'fps=25', '-r', '25', '-vsync', 'cfr',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0',
        '-crf', '19', '-preset', 'medium',
        '-g', '50', '-keyint_min', '50', '-sc_threshold', '0',
        '-video_track_timescale', '25', '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' });
      const stat = fs.statSync(mp4);
      console.log('mp4:', mp4, (stat.size / 1024 / 1024).toFixed(1), 'MB');
      execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', mp4], { stdio: 'inherit' });
    }
    console.log('done. files in', OUT);
  } finally {
    await browser.close();
    forwarder.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
