/* Final accessibility audit for KALA:
   1. Keyboard-only pass: Tab through every player control, screenshot the
      focus ring on each; operate play/seek/volume/settings by keyboard only.
   2. Bright-footage contrast: Daylight at its brightest frame, controls
      visible — the guidelines' explicit test.
   3. Reduced motion: with prefers-reduced-motion, the halo/twinkle/ambient
      drift must stop.
   Usage: node tools/audit-a11y.cjs <base-url> <out-dir> */
const { chromium } = require('/home/hatch/workspace/codegeist/video-recorder/node_modules/playwright');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startForwarder(localPort = 3129) {
  const raw = process.env.https_proxy || process.env.HTTPS_PROXY || '';
  const u = new URL(raw);
  const target = await dns.lookup(u.hostname, { family: 6 });
  const server = net.createServer((client) => {
    const upstream = net.connect({ host: target.address, port: Number(u.port) || 3128 });
    client.pipe(upstream); upstream.pipe(client);
    const onErr = () => { client.destroy(); upstream.destroy(); };
    client.on('error', onErr); upstream.on('error', onErr);
  });
  await new Promise((resolve, reject) => { server.listen(localPort, '127.0.0.1', resolve); server.on('error', reject); });
  return server;
}

(async () => {
  const BASE = process.argv[2] || 'http://localhost:4173';
  const OUT = process.argv[3] || '/tmp/kala-a11y';
  fs.mkdirSync(OUT, { recursive: true });
  const forwarder = await startForwarder();
  const browser = await chromium.launch({
    proxy: { server: 'http://127.0.0.1:3129', bypass: 'localhost,127.0.0.1' },
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  let pass = 0, fail = 0;
  const check = (name, ok, extra = '') => {
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
    ok ? pass++ : fail++;
  };
  try {
    // ── 1. Keyboard-only pass on the player-only page ─────────────────────
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/preview.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('video-player', { timeout: 30000 });
    await sleep(3500);

    // Start playback first: the bottom console only joins the tab order once
    // the video has started (before that, only the Eclipse + container are
    // focusable, which is the intended pre-start state).
    await page.locator('.video-controls-center-play').click();
    await sleep(2000);

    // Tab through the player: record each focused control's accessible name.
    const focused = [];
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      await sleep(150);
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return {
          tag: el.tagName.toLowerCase(),
          cls: (el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').toString().split(' ').slice(0, 3).join('.'),
          label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || '',
          outline: getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineColor,
          boxShadow: getComputedStyle(el).boxShadow.slice(0, 60),
        };
      });
      if (info) focused.push(info);
    }
    console.log('tab order:', JSON.stringify(focused.map((f) => f.label || f.cls), null, 1));
    const names = focused.map((f) => f.label);
    check('keyboard: reaches play', names.some((n) => /play/i.test(n)));
    check('keyboard: reaches mute', names.some((n) => /mute|volume/i.test(n)));
    check('keyboard: reaches seek slider', names.some((n) => /seek|progress|time/i.test(n)));
    check('keyboard: reaches settings', names.some((n) => /settings/i.test(n)));
    check('keyboard: reaches fullscreen', names.some((n) => /fullscreen/i.test(n)));
    // Focus ring visible: at least one focused element must show an outline
    // or a colored box-shadow (our amber ring).
    const ringed = focused.filter((f) => f.outline.startsWith('solid') || /251, 191, 36|rgb\(251/.test(f.boxShadow + f.outline));
    check('keyboard: visible focus ring on controls', ringed.length >= 3, `${ringed.length} ringed of ${focused.length}`);

    // Screenshot focus on the settings button.
    const settingsIdx = names.findIndex((n) => /settings/i.test(n));
    if (settingsIdx >= 0) {
      await page.evaluate(() => document.querySelector('.media-settings-button')?.focus());
      await sleep(400);
      await page.screenshot({ path: path.join(OUT, '01-focus-settings.png') });
      // Open the menu by keyboard, walk it, close with Escape.
      await page.keyboard.press('Enter');
      await sleep(700);
      const menuOpen = await page.locator('.media-menu-popup').isVisible().catch(() => false);
      check('keyboard: settings menu opens with Enter', menuOpen);
      await page.keyboard.press('ArrowDown');
      await sleep(300);
      await page.keyboard.press('Escape');
      await sleep(400);
      await page.keyboard.press('Escape');
      await sleep(400);
    }

    // Operate the player by keyboard only: K pauses, Space resumes, arrows seek.
    await page.evaluate(() => document.querySelector('.video-controls-center-play')?.focus());
    await page.keyboard.press('k');
    await sleep(800);
    const pausedByK = await page.evaluate(() => {
      const m = document.querySelector('mux-video');
      return m?.shadowRoot?.querySelector('video')?.paused === true;
    });
    check('keyboard: K pauses', pausedByK);
    await page.keyboard.press('Space');
    await sleep(1500);
    const playing = await page.evaluate(() => {
      const m = document.querySelector('mux-video');
      return m?.shadowRoot?.querySelector('video')?.paused === false;
    });
    check('keyboard: Space plays', playing);
    await page.keyboard.press('ArrowRight');
    await sleep(600);
    const t1 = await page.evaluate(() => document.querySelector('mux-video')?.shadowRoot?.querySelector('video')?.currentTime);
    check('keyboard: ArrowRight seeks forward', (t1 || 0) > 8, `t=${(t1 || 0).toFixed(1)}`);
    await page.keyboard.press('m');
    await sleep(300);
    const muted = await page.evaluate(() => document.querySelector('mux-video')?.shadowRoot?.querySelector('video')?.muted);
    check('keyboard: M mutes', muted === true);
    await page.keyboard.press('m');

    // Focus ring on the center play (paused state) — screenshot.
    await page.keyboard.press('k');
    await sleep(600);
    await page.evaluate(() => document.querySelector('.video-controls-center-play')?.focus());
    await sleep(400);
    await page.screenshot({ path: path.join(OUT, '02-focus-center-play.png') });

    // ── 2. Bright-footage contrast (Daylight, brightest frames) ───────────
    const page2 = await ctx.newPage();
    await page2.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page2.waitForSelector('#hero-player video-player', { timeout: 30000 });
    await sleep(2000);
    await page2.click('#footage-switcher button[data-footage="daylight"]');
    await page2.waitForFunction(() => {
      const v = document.querySelector('#hero-player video');
      return v && (v.readyState || 0) >= 2;
    }, { timeout: 20000 }).catch(() => {});
    await sleep(800);
    // Seek to ~12s (bright cloud seas) and play.
    await page2.evaluate(() => { const v = document.querySelector('#hero-player video'); if (v) v.currentTime = 12; });
    await page2.locator('#hero-player video-player').locator('.video-controls-center-play').click();
    await sleep(2000);
    // Wake controls and shoot the player close.
    const box = await page2.locator('#hero-player media-container').boundingBox();
    await page2.mouse.move(box.x + box.width / 2, box.y + box.height - 80);
    await sleep(400);
    await page2.locator('#hero-player').screenshot({ path: path.join(OUT, '03-daylight-bright-controls.png') });
    // Also pause on the brightest frame for the title/console contrast.
    await page2.keyboard.press('k');
    await sleep(500);
    await page2.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await sleep(400);
    await page2.locator('#hero-player').screenshot({ path: path.join(OUT, '04-daylight-bright-paused.png') });
    check('bright footage: daylight screenshots taken', true);

    // ── 3. Reduced motion ────────────────────────────────────────────────
    const rctx = await browser.newContext({
      viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true, reducedMotion: 'reduce',
    });
    const rpage = await rctx.newPage();
    await rpage.goto(`${BASE}/preview.html`, { waitUntil: 'domcontentloaded' });
    await rpage.waitForSelector('video-player', { timeout: 30000 });
    await sleep(3000);
    const motion = await rpage.evaluate(() => {
      const el = document.querySelector('.video-controls-center-play');
      const cs = el ? getComputedStyle(el, '::after') : null;
      const star = document.querySelector('.kala-chapter-star');
      const scs = star ? getComputedStyle(star) : null;
      return {
        haloAnimation: cs?.animationName || 'n/a',
        haloDuration: cs?.animationDuration || 'n/a',
        starAnimation: scs?.animationName || 'n/a',
      };
    });
    console.log('reduced motion styles:', JSON.stringify(motion));
    check('reduced motion: halo animation off', motion.haloAnimation === 'none' || motion.haloDuration === '0s', JSON.stringify(motion));
    await rpage.screenshot({ path: path.join(OUT, '05-reduced-motion.png') });

    console.log(`\n==== ${pass}/${pass + fail} checks passed ====`);
    process.exitCode = fail ? 1 : 0;
  } finally {
    await browser.close();
    forwarder.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
