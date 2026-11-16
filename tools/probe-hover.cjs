// Focused probe: slider hover state + thumbnail rendering.
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
  const forwarder = await startForwarder();
  const browser = await chromium.launch({
    proxy: { server: 'http://127.0.0.1:3129', bypass: 'localhost,127.0.0.1' },
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/preview.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video-player', { timeout: 30000 });
  await sleep(4000);
  // Start playback so the slider/preview behave as in real use.
  await page.locator('.video-controls-center-play').click();
  await sleep(1500);

  const slider = page.locator('media-time-slider');
  const sb = await slider.boundingBox();
  // Hover at 30% — inside chapter 2.
  await page.mouse.move(sb.x + sb.width * 0.3, sb.y + sb.height / 2);
  await sleep(1500);
  const hover = await page.evaluate(() => {
    const sliderEl = document.querySelector('media-time-slider');
    const img = document.querySelector('.media-slider-thumbnail-image');
    const thumb = document.querySelector('.media-slider-thumbnail');
    const title = document.querySelector('.media-time-slider-chapter-title');
    const preview = document.querySelector('.media-time-slider-preview');
    const cs = img ? getComputedStyle(img) : null;
    return {
      sliderPointing: sliderEl?.hasAttribute('data-pointing'),
      sliderPointer: getComputedStyle(sliderEl).getPropertyValue('--media-slider-pointer'),
      previewOpacity: preview ? getComputedStyle(preview).opacity : null,
      titleText: title?.textContent,
      titleVisible: title ? getComputedStyle(title).display : null,
      chapters: Array.from(document.querySelectorAll('.media-time-slider-chapter')).map((el) => ({
        highlighted: el.hasAttribute('data-highlighted'),
        active: el.hasAttribute('data-active'),
      })),
      imgStyle: img?.getAttribute('style'),
      imgObjectFit: cs?.objectFit,
      imgObjectPosition: cs?.objectPosition,
      imgWidth: cs?.width,
      imgHeight: cs?.height,
      imgNatural: img ? `${img.naturalWidth}x${img.naturalHeight}` : null,
      thumbBox: thumb?.getBoundingClientRect().toJSON(),
      imgBox: img?.getBoundingClientRect().toJSON(),
    };
  });
  console.log(JSON.stringify(hover, null, 2));

  // Zoomed screenshot of the preview card region.
  const pb = await page.locator('.media-time-slider-preview').boundingBox();
  if (pb) {
    await page.screenshot({
      path: '/tmp/kala-check/03b-preview-zoom.png',
      clip: { x: Math.max(0, pb.x - 20), y: Math.max(0, pb.y - 20), width: pb.width + 40, height: pb.height + 60 },
    });
  }
  await browser.close();
  forwarder.close();
})().catch((e) => { console.error(e); process.exit(1); });
