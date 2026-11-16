/* Focused probe: post-start Tab order + 'm' hotkey behavior. */
const { chromium } = require('/home/hatch/workspace/codegeist/video-recorder/node_modules/playwright');
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
    await sleep(3500);
    await page.locator('.video-controls-center-play').click();
    await sleep(2000);

    // Post-start Tab order.
    const order = [];
    for (let i = 0; i < 22; i++) {
      await page.keyboard.press('Tab');
      await sleep(120);
      const label = await page.evaluate(() => {
        const el = document.activeElement;
        return el === document.body ? '(body)' : (el.getAttribute('aria-label') || el.tagName + '.' + String(el.className).split(' ')[0]);
      });
      order.push(label);
    }
    console.log('post-start tab order:', JSON.stringify(order));

    // 'm' hotkey: read muted + volume at 300ms and 1200ms.
    const readMute = () => page.evaluate(() => {
      const m = document.querySelector('mux-video');
      const v = m?.shadowRoot?.querySelector('video');
      const btn = document.querySelector('.media-mute-button');
      return { muted: v?.muted, volume: v?.volume, btnPressed: btn?.getAttribute('aria-pressed'), btnMuted: btn?.getAttribute('data-muted') };
    });
    console.log('before m:', JSON.stringify(await readMute()));
    await page.keyboard.press('m');
    await sleep(300);
    console.log('300ms after m:', JSON.stringify(await readMute()));
    await sleep(1000);
    console.log('1300ms after m:', JSON.stringify(await readMute()));
    // Click mute for comparison.
    await page.locator('.media-mute-button').click();
    await sleep(500);
    console.log('after click:', JSON.stringify(await readMute()));
  } finally {
    await browser.close();
    forwarder.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
