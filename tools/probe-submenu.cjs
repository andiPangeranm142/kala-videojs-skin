/* Probe: does the Speed submenu actually open on click? */
const { chromium } = require('/home/hatch/workspace/codegeist/video-recorder/node_modules/playwright');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;
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
  const forwarder = await startForwarder();
  const browser = await chromium.launch({
    proxy: { server: 'http://127.0.0.1:3129', bypass: 'localhost,127.0.0.1' },
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto('http://localhost:4173/preview.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('video-player', { timeout: 30000 });
    await sleep(4000);
    // Start playback first — the bottom console only exists once the video
    // has started (before that, the poster shows just the Eclipse).
    await page.locator('.video-controls-center-play').click();
    await sleep(2000);
    const cb = await page.locator('media-container').boundingBox();
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height - 60);
    await sleep(500);
    await page.locator('.media-settings-button').click();
    await sleep(800);
    const before = await page.evaluate(() => [...document.querySelectorAll('.media-menu-item')].map((e) => e.textContent.trim()));
    console.log('main menu items:', JSON.stringify(before));
    await page.locator('.media-menu-item', { hasText: 'Speed' }).first().click();
    await sleep(800);
    const after = await page.evaluate(() => [...document.querySelectorAll('.media-menu-item')].map((e) => e.textContent.trim()));
    console.log('after Speed click:', JSON.stringify(after));
    const popups = await page.evaluate(() => [...document.querySelectorAll('.media-menu-popup')].map((e) => e.getBoundingClientRect().width + 'x' + e.getBoundingClientRect().height));
    console.log('popups:', popups);
    await page.screenshot({ path: '/tmp/kala-submenu.png' });
    // Try clicking a speed option if present.
    const opt = page.locator('.media-menu-item', { hasText: '1.25' }).first();
    console.log('1.25 option visible:', await opt.isVisible().catch(() => false));
    if (await opt.isVisible().catch(() => false)) {
      await opt.click();
      await sleep(600);
      const rate = await page.evaluate(() => {
        const m = document.querySelector('mux-video');
        return m?.shadowRoot?.querySelector('video')?.playbackRate;
      });
      console.log('playbackRate after clicking 1.25:', rate);
    }
  } finally {
    await browser.close();
    forwarder.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
