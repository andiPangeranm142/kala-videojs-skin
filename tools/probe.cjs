// Diagnose chapters + slider thumbnail wiring on the Kala preview page.
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
  const failed = [];
  page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.url()} :: HTTP ${r.status()}`); });

  await page.goto('http://localhost:4173/preview.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video-player', { timeout: 30000 });
  await sleep(4000);

  const info = await page.evaluate(() => {
    const player = document.querySelector('video-player');
    const mux = player.querySelector('mux-video');
    const shadowVideo = mux?.shadowRoot?.querySelector('video');
    const trackEl = mux?.querySelector('track');
    const chapters = Array.from(document.querySelectorAll('.media-time-slider-chapter')).map((el) => ({
      start: getComputedStyle(el).getPropertyValue('--media-slider-chapter-start'),
      end: getComputedStyle(el).getPropertyValue('--media-slider-chapter-end'),
      active: el.hasAttribute('data-active'),
    }));
    const textTracks = (el) => {
      if (!el || !el.textTracks) return 'n/a';
      return Array.from(el.textTracks).map((t) => ({ kind: t.kind, label: t.label, mode: t.mode, cues: t.cues?.length }));
    };
    return {
      trackInLightDom: !!trackEl,
      trackSrc: trackEl?.getAttribute('src'),
      trackReadyState: trackEl?.readyState,
      muxTextTracks: textTracks(mux),
      shadowVideoTextTracks: textTracks(shadowVideo),
      hasShadowVideo: !!shadowVideo,
      chapterDivs: chapters,
      thumbImg: (() => {
        const img = document.querySelector('.media-slider-thumbnail-image');
        return img ? { src: img.getAttribute('src'), complete: img.complete, naturalWidth: img.naturalWidth, currentSrc: img.currentSrc } : null;
      })(),
      chapterTitleEl: document.querySelector('.media-time-slider-chapter-title')?.textContent,
    };
  });
  console.log(JSON.stringify(info, null, 2));

  // Hover the slider at 30% and read the preview state.
  const slider = page.locator('media-time-slider');
  const sb = await slider.boundingBox();
  await page.mouse.move(sb.x + sb.width * 0.3, sb.y + sb.height / 2);
  await sleep(1200);
  const hover = await page.evaluate(() => {
    const img = document.querySelector('.media-slider-thumbnail-image');
    const title = document.querySelector('.media-time-slider-chapter-title');
    const chapterDivs = Array.from(document.querySelectorAll('.media-time-slider-chapter')).map((el) => ({
      highlighted: el.hasAttribute('data-highlighted'),
      active: el.hasAttribute('data-active'),
    }));
    return {
      thumbSrc: img?.getAttribute('src'),
      thumbNatural: img?.naturalWidth,
      titleText: title?.textContent,
      chapters: chapterDivs,
    };
  });
  console.log('HOVER:', JSON.stringify(hover, null, 2));
  console.log('FAILED REQUESTS:', JSON.stringify(failed, null, 2));

  await browser.close();
  forwarder.close();
})().catch((e) => { console.error(e); process.exit(1); });
