// Kala skin verification: screenshots + functional checks against the built
// demo (serve dist/ first, e.g. `python3 -m http.server 4173` in dist/).
// Run: node tools/check.mjs [baseUrl] [outDir]
// Uses the video-recorder project's Playwright + the IPv6 egress-proxy
// forwarder recipe (Chromium cannot use the proxy directly).
const { chromium } = require('/home/hatch/workspace/codegeist/video-recorder/node_modules/playwright');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || '/tmp/kala-check';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

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

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

(async () => {
  const forwarder = await startForwarder();
  const browser = await chromium.launch({
    proxy: { server: 'http://127.0.0.1:3129', bypass: 'localhost,127.0.0.1' },
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  // ── Desktop ──────────────────────────────────────────────────────────
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') log(`CONSOLE ERROR: ${m.text()}`); });
  page.on('pageerror', (e) => log(`PAGE ERROR: ${e.message}`));

  await page.goto(`${BASE}/preview.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video-player', { timeout: 30000 });
  // The stream starts loading lazily; wait until data is actually buffered.
  await page.waitForFunction(() => {
    const player = document.querySelector('video-player');
    const media = player?.querySelector('mux-video, video');
    const video = media?.tagName === 'VIDEO' ? media : media?.shadowRoot?.querySelector('video');
    return (video?.readyState || 0) >= 2;
  }, { timeout: 20000 }).catch(() => {});
  await sleep(1000);

  const state = async () => page.evaluate(() => {
    const player = document.querySelector('video-player');
    const media = player.querySelector('mux-video, video');
    const video = media.tagName === 'VIDEO' ? media : media.shadowRoot?.querySelector('video');
    return {
      hasPlayer: !!player,
      mediaTag: media?.tagName,
      readyState: video?.readyState,
      paused: video?.paused,
      currentTime: video?.currentTime,
      duration: video?.duration,
      title: player.getAttribute('content-title'),
      chapterLabel: document.querySelector('.kala-chapter-label')?.textContent || '',
      controlsVisible: document.querySelector('media-controls-content')?.hasAttribute('data-visible'),
    };
  });

  let s = await state();
  log(`initial state: ${JSON.stringify(s)}`);
  check('player mounts', s.hasPlayer);
  check('video loads (readyState>=2)', (s.readyState || 0) >= 2, `readyState=${s.readyState}`);
  check('duration known', !!s.duration && s.duration > 0, `duration=${s.duration}`);

  await page.screenshot({ path: `${OUT}/01-poster-desktop.png` });

  // Play via the center eclipse button.
  const centerPlay = page.locator('.video-controls-center-play');
  await centerPlay.click();
  await sleep(2500);
  s = await state();
  check('plays after clicking center play', s.paused === false, `paused=${s.paused} t=${s.currentTime?.toFixed(1)}`);
  check('chapter label updates', s.chapterLabel.length > 0, `"${s.chapterLabel}"`);

  // Move the mouse over the player to keep controls visible, then shoot.
  const box = await page.locator('media-container').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 60);
  await sleep(800);
  await page.screenshot({ path: `${OUT}/02-playing-controls.png` });

  // Seek via the time slider (click at 60%).
  const slider = page.locator('media-time-slider');
  const sb = await slider.boundingBox();
  await page.mouse.click(sb.x + sb.width * 0.6, sb.y + sb.height / 2);
  await sleep(1500);
  s = await state();
  const expected = (s.duration || 0) * 0.6;
  check('seek via slider click', Math.abs((s.currentTime || 0) - expected) < 8, `t=${s.currentTime?.toFixed(1)} expected~${expected.toFixed(1)}`);

  // Hover the slider for the preview card.
  await page.mouse.move(sb.x + sb.width * 0.3, sb.y + sb.height / 2);
  await sleep(900);
  await page.screenshot({ path: `${OUT}/03-slider-preview.png` });
  const previewVisible = await page.evaluate(() => {
    const p = document.querySelector('.media-time-slider-preview');
    return p ? getComputedStyle(p).opacity : 'n/a';
  });
  check('slider preview appears on hover', previewVisible === '1', `opacity=${previewVisible}`);
  const previewText = await page.evaluate(() => document.querySelector('.media-time-slider-preview-label')?.textContent?.trim());
  log(`preview label: "${previewText}"`);

  // Pause via bar play button, then keyboard Space to resume.
  await page.locator('.kala-bar-play').click();
  await sleep(800);
  s = await state();
  check('pause via bar play button', s.paused === true);
  await page.keyboard.press('Space');
  await sleep(1200);
  s = await state();
  check('resume via Space hotkey', s.paused === false);

  // Mute toggle.
  await page.locator('.media-mute-button').click();
  await sleep(500);
  const muted = await page.evaluate(() => {
    const m = document.querySelector('mux-video, video');
    const v = m.tagName === 'VIDEO' ? m : m.shadowRoot?.querySelector('video');
    return v?.muted;
  });
  check('mute toggles', muted === true);
  await page.locator('.media-mute-button').click();

  // Volume slider: hover the group, check it expands.
  await page.locator('.kala-volume-group').hover();
  await sleep(700);
  const volW = await page.evaluate(() => document.querySelector('.media-volume-slider')?.getBoundingClientRect().width);
  check('volume slider expands on hover', (volW || 0) > 40, `width=${volW}`);
  await page.screenshot({ path: `${OUT}/04-volume.png` });

  // Settings menu.
  await page.locator('.media-settings-button').click();
  await sleep(800);
  const menuOpen = await page.locator('.media-menu-popup').isVisible().catch(() => false);
  check('settings menu opens', menuOpen);
  await page.screenshot({ path: `${OUT}/05-settings-menu.png` });
  // Open the Speed submenu.
  const speedItem = page.locator('.media-menu-item', { hasText: 'Speed' }).first();
  await speedItem.click();
  await sleep(600);
  await page.screenshot({ path: `${OUT}/06-speed-menu.png` });
  await page.keyboard.press('Escape');
  await sleep(400);

  // Keyboard shortcuts dialog via "?" key.
  await page.locator('media-container').click({ position: { x: 10, y: 10 } }).catch(() => {});
  await page.keyboard.press('?');
  await sleep(600);
  const kbdOpen = await page.evaluate(() => !document.querySelector('.kala-kbd-dialog')?.hasAttribute('hidden'));
  check('keyboard dialog opens with "?"', kbdOpen);
  await page.screenshot({ path: `${OUT}/07-keyboard-dialog.png` });
  await page.keyboard.press('Escape');
  await sleep(400);

  // Fullscreen.
  await page.locator('.media-fullscreen-button').click();
  await sleep(1000);
  const fs = await page.evaluate(() => !!document.fullscreenElement);
  check('fullscreen enters', fs);
  await page.screenshot({ path: `${OUT}/08-fullscreen.png` });
  await page.keyboard.press('Escape');
  await sleep(800);

  // Time display.
  const timeText = await page.evaluate(() => document.querySelector('.media-time-group')?.textContent?.trim());
  log(`time group: "${timeText}"`);

  // ── Mobile ───────────────────────────────────────────────────────────
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });
  const mpage = await mctx.newPage();
  await mpage.goto(`${BASE}/preview.html`, { waitUntil: 'domcontentloaded' });
  await mpage.waitForSelector('video-player', { timeout: 30000 });
  await sleep(3000);
  await mpage.screenshot({ path: `${OUT}/09-mobile-poster.png` });
  await mpage.locator('.video-controls-center-play').tap();
  await sleep(2000);
  const mbox = await mpage.locator('media-container').boundingBox();
  await mpage.touchscreen.tap(mbox.x + mbox.width / 2, mbox.y + mbox.height - 40);
  await sleep(800);
  await mpage.screenshot({ path: `${OUT}/10-mobile-playing.png` });
  const mState = await mpage.evaluate(() => {
    const player = document.querySelector('video-player');
    const media = player.querySelector('mux-video, video');
    const video = media.tagName === 'VIDEO' ? media : media.shadowRoot?.querySelector('video');
    return { paused: video?.paused, t: video?.currentTime };
  });
  check('mobile: plays on tap', mState.paused === false, `t=${mState.t?.toFixed(1)}`);

  await browser.close();
  forwarder.close();

  const failed = results.filter((r) => !r.ok);
  log(`\n==== ${results.length - failed.length}/${results.length} checks passed ====`);
  if (failed.length) {
    log(`FAILED: ${failed.map((f) => f.name).join(', ')}`);
    process.exitCode = 1;
  }
})().catch((e) => { console.error(e); process.exit(1); });
