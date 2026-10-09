import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const out = process.env.PELICAN_QA_OUTPUT || '/tmp/pelican-flight-qa';
await mkdir(out, { recursive: true });

// Optional integration check with an already installed Circle Reader controller.
// Its source stays local; the portable fixture models its documented double-A key.
const readerScript = process.env.CIRCLE_KEYS_SCRIPT
  ? await readFile(process.env.CIRCLE_KEYS_SCRIPT, 'utf8')
  : `window.definePlugin('keys', class {
      constructor(_, app) {
        this.keys = []; this.counter = 0; this.timer = null;
        document.addEventListener('keydown', e => {
          if (document.activeElement?.matches('input, textarea, [contenteditable="true"]')) return;
          this.keys.push(e.key); this.counter++;
          if (this.counter === 1) this.timer = setTimeout(() => { this.counter = 0; this.keys = []; }, 500);
          else if (this.counter === 2) {
            clearTimeout(this.timer);
            if (this.keys.join(' ') === 'a a') app.fire('enter_or_exit');
            this.counter = 0; this.keys = [];
          }
        });
      }
    });`;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // Register the reader before the game, as document_start extensions do.
  await context.addInitScript({ content: `
    window.__readerTest = { activations: 0, leaked: [] };
    window.definePlugin = (name, Plugin) => {
      if (name !== 'keys') return;
      const app = { field: () => false, record() {}, fire() { window.__readerTest.activations++; } };
      const controller = new Plugin(null, app);
      controller.map = { enter_or_exit: 'a a' };
      window.__readerTest.controller = controller;
    };
    ${readerScript}
    for (const type of ['keydown', 'keypress', 'keyup']) {
      for (const capture of [false, true]) {
        document.addEventListener(type, e => {
          if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code))
            window.__readerTest.leaked.push({ type, code: e.code, capture, prevented: e.defaultPrevented });
        }, capture);
      }
    }
  ` });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.clock.install({ time: new Date('2026-10-10T00:00:00Z') });
  await page.goto('http://localhost:4173/?q=low&freeze=1&dt=.05');
  await page.waitForFunction(() => !!window.__pelican);
  await page.clock.pauseAt(new Date('2026-10-10T00:01:00Z'));
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyA');
  assert.equal(await page.evaluate(() => window.__readerTest.activations), 1, 'reader fixture must reproduce double-A outside gameplay');
  await page.click('#startMute');
  await page.locator('#intro').waitFor({ state: 'hidden' });
  await page.evaluate(() => { window.__readerTest.leaked = []; });
  const lane = () => page.evaluate(() => window.__pelican.S.laneTarget);
  const startLane = await lane();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.down('KeyA');
    await page.clock.runFor(16);
    await page.keyboard.up('KeyA');
  }
  assert.equal(await page.evaluate(() => window.__readerTest.activations), 1, 'rapid A presses must not enter reader mode');
  assert.deepEqual(await page.evaluate(() => window.__readerTest.leaked), [], 'game keys must not reach document listeners');
  assert.ok(await lane() < startLane, 'A must still steer left');
  assert.ok(await page.locator('#app canvas').evaluate(el => el === document.activeElement), 'starting must focus the game');

  const releasedLane = await lane();
  await page.clock.runFor(150);
  assert.equal(await lane(), releasedLane, 'release must not leave steering held');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyD'); // repeat keydown must be intercepted too
  await page.clock.runFor(100);
  await page.keyboard.up('KeyD');
  assert.ok(await lane() > releasedLane);
  const beforeArrow = await lane();
  await page.keyboard.down('ArrowLeft');
  await page.clock.runFor(100);
  await page.keyboard.up('ArrowLeft');
  assert.ok(await lane() < beforeArrow, 'arrow keys must remain an alternative');

  const beforeShortcut = await lane();
  await page.keyboard.press('Meta+KeyA');
  assert.equal(await lane(), beforeShortcut, 'system shortcuts must not steer');
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'keyboard-test-input';
    input.style.cssText = 'position:fixed;top:300px;left:10px;z-index:100';
    document.body.appendChild(input);
  });
  await page.locator('#keyboard-test-input').pressSequentially('aassdd');
  assert.equal(await page.locator('#keyboard-test-input').inputValue(), 'aassdd', 'text inputs must keep normal typing');
  assert.equal(await lane(), beforeShortcut);
  await page.evaluate(() => document.getElementById('keyboard-test-input').remove());
  await page.click('#app canvas', { position: { x: 800, y: 300 } });
  assert.ok(await page.locator('#app canvas').evaluate(el => el === document.activeElement));

  await page.keyboard.down('KeyA');
  await page.clock.runFor(32);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const blurredLane = await lane();
  await page.clock.runFor(150);
  assert.equal(await lane(), blurredLane, 'losing focus must clear steering');
  await page.keyboard.up('KeyA');
  await page.screenshot({ path: out + '/keyboard-fixed.png' });
  assert.deepEqual(errors, []);
  const report = { reader: process.env.CIRCLE_KEYS_SCRIPT ? 'installed Circle Reader controller' : 'double-A fixture', rapidAPresses: 12, readerBlocked: true, gameFocused: true, steeringAndRelease: true, arrowKeys: true, typingAndSystemShortcuts: true, blurClearsInput: true, errors };
  await writeFile(out + '/keyboard-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
