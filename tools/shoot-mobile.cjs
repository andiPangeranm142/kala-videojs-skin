/* Capture a mobile (phone viewport) screenshot of the KALA showcase hero
   playing, then compose it onto a 1600x1200 (4:3) canvas for submission.
   Usage: node tools/shoot-mobile.cjs <base-url> <out-dir> */
const { chromium } = require('/home/hatch/workspace/codegeist/video-recorder/node_modules/playwright');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || '/tmp/kala-mobile';
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
  fs.mkdirSync(OUT, { recursive: true });
  const forwarder = await startForwarder();
  const browser = await chromium.launch({
    proxy: { server: 'http://127.0.0.1:3129', bypass: 'localhost,127.0.0.1' },
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      ignoreHTTPSErrors: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#hero-player video-player', { timeout: 30000 });
    await page.waitForFunction(() => {
      const p = document.querySelector('#hero-player video-player');
      const m = p?.querySelector('mux-video, video');
      const v = m?.tagName === 'VIDEO' ? m : m?.shadowRoot?.querySelector('video');
      return (v?.readyState || 0) >= 2;
    }, { timeout: 20000 }).catch(() => {});
    await sleep(1200);

    // Bring the player into view and start playback.
    await page.locator('#hero-player').scrollIntoViewIfNeeded();
    await sleep(500);
    await page.locator('#hero-player video-player').locator('.video-controls-center-play').tap();
    await sleep(2500);

    // Wake the controls with a tap, then shoot before they fade.
    const box = await page.locator('#hero-player media-container').boundingBox();
    await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await sleep(400);
    const raw = path.join(OUT, 'mobile-raw.png');
    await page.screenshot({ path: raw });
    console.log('raw mobile shot:', raw);

    // Compose onto a 1600x1200 canvas: dark observatory background, the
    // phone screenshot scaled to fit with margin.
    const composed = path.join(OUT, 'kala-mobile.png');
    execFileSync('ffmpeg', ['-v', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=0x04060f:s=1600x1200',
      '-i', raw,
      '-filter_complex',
      '[1:v]scale=508:1100:flags=lanczos[phone];' +
      '[0:v][phone]overlay=(W-w)/2:(H-h)/2,drawbox=x=546:y=50:w=508:h=1100:color=white@0.14:t=2',
      '-frames:v', '1', composed], { stdio: 'inherit' });
    console.log('composed:', composed);
  } finally {
    await browser.close();
    forwarder.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
