/* Probe: inspect the settings menu DOM — popover state, submenu wiring. */
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
    await sleep(1500);

    const info = await page.evaluate(() => {
      const out = {};
      const popup = document.querySelector('#kala-settings-popup');
      out.popup = {
        popover: popup?.getAttribute('popover'),
        tag: popup?.tagName,
        open: popup?.matches(':popover-open'),
      };
      out.contents = [...document.querySelectorAll('media-menu-content')].map((c) => ({
        id: c.id || '(root)',
        popover: c.getAttribute('popover'),
        hidden: c.hasAttribute('hidden'),
        display: getComputedStyle(c).display,
        visibility: getComputedStyle(c).visibility,
      }));
      out.triggers = [...document.querySelectorAll('.media-menu-item[commandfor]')].map((t) => ({
        commandfor: t.getAttribute('commandfor'),
        command: t.getAttribute('command'),
        role: t.getAttribute('role'),
        ariaExpanded: t.getAttribute('aria-expanded'),
        dataItem: t.hasAttribute('data-item'),
      }));
      return out;
    });
    console.log(JSON.stringify(info, null, 2));

    // Open menu, click Speed, then re-inspect.
    const cb = await page.locator('media-container').boundingBox();
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height - 60);
    await sleep(400);
    await page.locator('.media-settings-button').click();
    await sleep(700);
    await page.locator('.media-menu-item', { hasText: 'Speed' }).first().click();
    await sleep(700);
    const after = await page.evaluate(() => {
      const speed = document.querySelector('#kala-menu-speed');
      return {
        speedDisplay: getComputedStyle(speed).display,
        speedVisibility: getComputedStyle(speed).visibility,
        speedHidden: speed.hasAttribute('hidden'),
        speedOpen: speed.matches(':popover-open'),
        popupOpen: document.querySelector('#kala-settings-popup').matches(':popover-open'),
        rootDisplay: getComputedStyle(document.querySelector('#kala-settings-popup > media-menu-content')).display,
        activeElement: document.activeElement?.tagName + '.' + document.activeElement?.className,
      };
    });
    console.log('after Speed click:', JSON.stringify(after, null, 2));

    // Count the speed options and check whether the popup scrolls.
    const speedInfo = await page.evaluate(() => {
      const group = document.querySelector('#kala-menu-speed media-playback-rate-radio-group');
      const items = [...group.querySelectorAll('.media-menu-radio-item')].map((i) => i.textContent.trim());
      const popup = document.querySelector('#kala-settings-popup');
      const content = document.querySelector('#kala-menu-speed');
      return {
        options: items,
        popupScrollHeight: popup.scrollHeight,
        popupClientHeight: popup.clientHeight,
        contentScrollHeight: content.scrollHeight,
        contentClientHeight: content.clientHeight,
      };
    });
    console.log('speed options:', JSON.stringify(speedInfo, null, 2));

    // Keyboard: walk down the submenu — focus must reach 2× (the last option),
    // scrolling the list as it goes. Start from the first item.
    await page.keyboard.press('Home');
    await sleep(200);
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
    await sleep(400);
    const focusInfo = await page.evaluate(() => ({
      focused: document.activeElement?.textContent?.trim(),
      scrollTop: document.querySelector('#kala-menu-speed')?.scrollTop,
    }));
    console.log('after Home + 6× ArrowDown:', JSON.stringify(focusInfo));
  } finally {
    await browser.close();
    forwarder.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
