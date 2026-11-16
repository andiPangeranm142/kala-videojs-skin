/* Verify the KALA showcase page: hero player mounts, sky/footage switchers
   work, ambient toggle works, compact player mounts, desktop + mobile shots.
   Usage: node tools/check-showcase.cjs <base-url> <out-dir> */
const { chromium } = require('/home/hatch/workspace/codegeist/video-recorder/node_modules/playwright');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || '/tmp/kala-showcase';
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
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  let pass = 0;
  let fail = 0;
  const check = (name, ok, extra = '') => {
    console.log(`[${new Date().toISOString().slice(11, 19)}] ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
    ok ? pass++ : fail++;
  };

  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('  pageerror:', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('  console.error:', m.text().slice(0, 200)); });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#hero-player video-player', { timeout: 30000 });
    await page.waitForFunction(() => {
      const p = document.querySelector('#hero-player video-player');
      const m = p?.querySelector('mux-video, video');
      const v = m?.tagName === 'VIDEO' ? m : m?.shadowRoot?.querySelector('video');
      return (v?.readyState || 0) >= 2;
    }, { timeout: 20000 }).catch(() => {});
    await sleep(1500);

    // Hero screenshot (paused, poster + eclipse)
    await page.screenshot({ path: path.join(OUT, '01-hero-paused.png') });

    // Play + screenshot
    const hero = page.locator('#hero-player video-player');
    await hero.locator('.video-controls-center-play').click();
    await sleep(3000);
    check('hero: plays on click', await page.evaluate(() => {
      const m = document.querySelector('#hero-player mux-video');
      return m?.shadowRoot?.querySelector('video')?.paused === false;
    }));
    await page.screenshot({ path: path.join(OUT, '02-hero-playing.png') });

    // Sky switch to Aurora
    await page.click('#sky-switcher button[data-sky="aurora"]');
    await sleep(600);
    check('sky switcher: aurora applied', await page.evaluate(() =>
      document.querySelector('#hero-player media-container')?.getAttribute('data-sky') === 'aurora'));
    await page.screenshot({ path: path.join(OUT, '03-sky-aurora.png') });

    // Sky switch to Ember
    await page.click('#sky-switcher button[data-sky="ember"]');
    await sleep(600);
    check('sky switcher: ember applied', await page.evaluate(() =>
      document.querySelector('#hero-player media-container')?.getAttribute('data-sky') === 'ember'));
    await page.click('#sky-switcher button[data-sky="midnight"]');
    await sleep(400);

    // Footage switch to Daylight
    await page.click('#footage-switcher button[data-footage="daylight"]');
    await page.waitForSelector('#hero-player video-player', { timeout: 10000 });
    await page.waitForFunction(() => {
      const v = document.querySelector('#hero-player video');
      return v && (v.readyState || 0) >= 2;
    }, { timeout: 20000 }).catch(() => {});
    await sleep(1200);
    check('footage switch: daylight mp4 loads', await page.evaluate(() => {
      const v = document.querySelector('#hero-player video');
      return !!v && (v.readyState || 0) >= 2 && v.duration > 100;
    }));
    const title = await page.evaluate(() =>
      document.querySelector('#hero-player .kala-chapter-label')?.textContent || '');
    check('footage switch: daylight chapters load', title.includes('First Light'), title);
    const dl = page.locator('#hero-player video-player');
    await dl.locator('.video-controls-center-play').click();
    await sleep(2500);
    await page.screenshot({ path: path.join(OUT, '04-daylight-playing.png') });
    // Pause for the remaining screenshots
    await page.keyboard.press('k');

    // Ambient toggle
    await page.click('#ambient-toggle');
    await sleep(400);
    check('ambient toggle: off', await page.evaluate(() =>
      document.querySelector('#stage')?.classList.contains('ambient-off') === true));
    await page.click('#ambient-toggle');
    await sleep(400);

    // Full-page screenshot (desktop)
    await page.screenshot({ path: path.join(OUT, '05-full-page.png'), fullPage: true });

    // Compact player section
    await page.locator('#compact-player').scrollIntoViewIfNeeded();
    await sleep(800);
    check('compact player: mounted', await page.evaluate(() =>
      !!document.querySelector('#compact-player video-player')));
    await page.screenshot({ path: path.join(OUT, '06-compact.png') });

    // Mobile
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
    const mpage = await mctx.newPage();
    await mpage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await mpage.waitForSelector('#hero-player video-player', { timeout: 30000 });
    await sleep(2500);
    await mpage.screenshot({ path: path.join(OUT, '07-mobile-hero.png') });
    await mpage.locator('#hero-player video-player').locator('.video-controls-center-play').tap();
    await sleep(2500);
    check('mobile: plays on tap', await mpage.evaluate(() => {
      const m = document.querySelector('#hero-player mux-video');
      return m?.shadowRoot?.querySelector('video')?.paused === false;
    }));
    await mpage.screenshot({ path: path.join(OUT, '08-mobile-playing.png') });
    await mpage.screenshot({ path: path.join(OUT, '09-mobile-full.png'), fullPage: true });

    console.log(`\n==== ${pass}/${pass + fail} checks passed ====`);
    process.exitCode = fail ? 1 : 0;
  } finally {
    await browser.close();
    forwarder.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
