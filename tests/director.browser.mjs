// Real Next proxy -> Go handlers -> disposable PostgreSQL; provider/media fixtures only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || '/Users/mac/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:13139';
const fixtureBase = process.env.DIRECTOR_FIXTURE_URL || 'http://127.0.0.1:18139';
const artifacts = process.env.ARTIFACT_DIR || '/tmp/director-web-20261104/browser';
fs.mkdirSync(artifacts, { recursive: true });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const observations = [];
const findings = [];
let browser;

async function eventually(read, check, message, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (check(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

async function characterScenarios(width, original) {
  const context = await browser.newContext({ viewport: { width, height: 1050 } });
  await context.addCookies([{ name: 'ezgen_session', value: 'director-character-fixture', url: base }]);
  let brokenCast = false;
  await context.route(/^https:\/\/(owned|samples)\.test\//, route => brokenCast ? route.abort('failed') : route.fulfill({ contentType: 'image/png', body: png }));
  let project = { ...structuredClone(original), step: 'idea', idea: { ...original.idea, characterAssetIds: [] } };
  let assetError = true;
  let rejectCharacter = true;
  let assetReads = 0;
  const owned = { id: '11111111-1111-4111-8111-111111111111', name: 'นักเดินทางในคลัง', description: 'ตัวละครที่ผู้ใช้เป็นเจ้าของ', assetType: 'character', mediaUrl: 'https://owned.test/character.png', status: 'ready', scope: 'personal', version: 1 };
  const created = { ...owned, id: '22222222-2222-4222-8222-222222222222', name: 'ดาวน้อย' };
  const posts = [], errors = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/api/proxy/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace('/api/proxy/', '');
    if (path === `director/projects/${project.id}` && request.method() === 'GET') return route.fulfill({ json: { data: project } });
    if (path === `director/projects/${project.id}/idea`) {
      const body = request.postDataJSON(); posts.push({ path, body });
      project = { ...project, revision: project.revision + 1, idea: { ...project.idea, ...body } };
      return route.fulfill({ json: { data: project } });
    }
    if (path === 'assets' && request.method() === 'GET') {
      assetReads += 1;
      await new Promise(resolve => setTimeout(resolve, 350));
      if (assetError) return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: 'คลังตัวละครไม่พร้อมชั่วคราว' } });
      return route.fulfill({ json: { data: { items: [owned], total: 1, page: 1, limit: 50 } } });
    }
    if (path === `assets/${owned.id}`) return route.fulfill({ json: { data: owned } });
    if (path === `assets/${created.id}`) return route.fulfill({ json: { data: created } });
    if (path === 'image-jobs') {
      const body = request.postDataJSON(); posts.push({ path, body });
      assert.equal(body.category, 'character'); assert.equal(body.aspectRatio, '3:4'); assert.equal(body.designFormat, 'full_body'); assert.match(body.idempotencyKey, /^[0-9a-f-]{36}$/);
      if (rejectCharacter) { rejectCharacter = false; return route.fulfill({ status: 400, json: { code: 'VALIDATION_ERROR', message: 'กรุณาปรับรูปลักษณ์ตัวละคร' } }); }
      return route.fulfill({ json: { data: { jobId: 'character-job', status: 'queued' } } });
    }
    if (path === 'jobs/character-job') return route.fulfill({ json: { data: { jobId: 'character-job', status: 'succeeded', progress: 100, result: { mediaType: 'image', mediaUrl: owned.mediaUrl }, error: null } } });
    if (path === 'assets' && request.method() === 'POST') {
      const body = request.postDataJSON(); posts.push({ path, body });
      assert.equal(body.jobId, 'character-job'); assert.equal(body.assetType, 'character'); assert.equal(body.name, 'ดาวน้อย');
      return route.fulfill({ json: { data: created } });
    }
    return route.continue();
  });
  try {
    await page.goto(`${base}/studio/director/${project.id}`);
    await page.getByRole('alert').filter({ hasText: 'คลังตัวละครไม่พร้อมชั่วคราว' }).waitFor();
    assetError = false;
    await page.getByRole('button', { name: 'โหลดตัวละครใหม่', exact: true }).click();
    await page.getByRole('button', { name: /นักเดินทางในคลัง/ }).click();
    await eventually(async () => project, value => value.idea.characterAssetIds.includes(owned.id), 'owned character selection fixture');
    await page.getByRole('button', { name: 'สร้างตัวละครใหม่', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('ชื่อตัวละคร', { exact: true }).fill('ดาวน้อย');
    await dialog.getByLabel('รูปลักษณ์', { exact: true }).fill('นักเดินทางสวมเสื้อคลุมสีฟ้า');
    await dialog.getByRole('button', { name: 'สร้างภาพตัวละคร', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: 'กรุณาปรับรูปลักษณ์ตัวละคร' }).waitFor();
    console.log(`${width}: character rejected state ${await dialog.ariaSnapshot()}`);
    assert.equal(await dialog.locator('textarea').isDisabled(), false);
    await dialog.locator('textarea').fill('นักเดินทางสวมเสื้อคลุมสีฟ้าและสะพายกระเป๋า');
    await dialog.getByRole('button', { name: 'สร้างภาพตัวละคร', exact: true }).click();
    await dialog.getByRole('button', { name: 'ใช้ตัวละครนี้', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await eventually(async () => project, value => value.idea.characterAssetIds.includes(created.id), 'created character selection fixture');
    const readsBeforeMediaError = assetReads;
    brokenCast = true;
    await page.locator('aside[aria-label="ตัวละคร"] img').first().evaluate(element => { element.src += '?fixture-expired=1'; });
    await eventually(async () => assetReads, value => value > readsBeforeMediaError, 'cast media refresh');
    await page.waitForTimeout(1500);
    const settledAssetReads = assetReads;
    await page.waitForTimeout(2500);
    assert.equal(assetReads, settledAssetReads, 'broken cast image must not cause an asset refetch loop');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${artifacts}/characters-${width}.png`, fullPage: true });
    return { width, posts, errors, assetReads, boundary: 'Explicit browser API-response fixtures for assets/image-jobs/jobs and Director project state; Character Studio live backend/provider NOT_RUN' };
  } catch (error) {
    await page.screenshot({ path: `${artifacts}/character-failure-${width}.png`, fullPage: true });
    fs.writeFileSync(`${artifacts}/character-failure-${width}.json`, JSON.stringify({ error: error.stack, errors, posts, dom: await page.locator('body').innerText() }, null, 2));
    throw error;
  } finally { await context.close(); }
}

try {
  browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  if (process.env.CHARACTER_ONLY_PROJECT) {
    const context = await browser.newContext();
    await context.addCookies([{ name: 'ezgen_session', value: 'director-character-fixture', url: base }]);
    const response = await context.request.get(`${base}/api/proxy/director/projects/${process.env.CHARACTER_ONLY_PROJECT}`);
    assert.equal(response.status(), 200);
    const original = (await response.json()).data;
    await context.close();
    observations.push(await characterScenarios(1440, original));
  } else for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 1050 } });
    await context.addCookies([{ name: 'ezgen_session', value: 'director-browser-fixture', url: base }]);
    let failMedia = false;
    await context.route(/^https:\/\/(owned|samples)\.test\//, route => failMedia ? route.abort('failed') : route.fulfill({ contentType: 'image/png', body: png }));
    const page = await context.newPage();
    const errors = [], consoleErrors = [], network = [], createBodies = [], reads = [];
    let dropCreate = true;
    await context.route(`${base}/api/proxy/director/projects`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      createBodies.push(route.request().postDataJSON());
      if (!dropCreate) return route.continue();
      dropCreate = false;
      await route.fetch();
      return route.abort('failed');
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', event => { if (event.type() === 'error') consoleErrors.push(event.text()); });
    page.on('request', request => {
      if (request.method() === 'GET' && /\/api\/proxy\/director\/projects\/[^/?]+(?:\?|$)/.test(request.url())) reads.push({ url: request.url(), headers: request.headers(), at: Date.now() });
    });
    page.on('response', response => {
      if (response.url().includes('/api/proxy/director/')) network.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() });
    });
    let id;
    const project = async () => {
      const response = await context.request.get(`${base}/api/proxy/director/projects/${id}`);
      assert.equal(response.status(), 200);
      return (await response.json()).data;
    };
    const controls = async body => {
      const response = await context.request.post(`${fixtureBase}/__fixture/controls`, { data: body });
      assert.equal(response.status(), 204);
    };
    const navigateStep = async (label, index) => {
      const nav = page.getByRole('navigation', { name: 'ขั้นตอน' });
      const named = nav.getByRole('button', { name: new RegExp(label) });
      if (await named.count()) return named.click();
      findings.push({ width, criterion: 'step navigation has meaningful accessible names', observed: `missing ${label} button name` });
      await page.screenshot({ path: `${artifacts}/step-label-finding-${width}.png`, fullPage: true });
      // Continue other scenarios only after recording this acceptance failure.
      return nav.getByRole('button').nth(index).click();
    };
    try {
      await page.goto(`${base}/studio/director`);
      await page.getByRole('heading', { name: 'ผู้กำกับ', exact: true }).waitFor();
      await page.screenshot({ path: `${artifacts}/hub-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'สร้างโปรเจกต์', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.equal(await dialog.locator('input').first().evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      if (!await page.getByRole('button', { name: 'สร้างโปรเจกต์', exact: true }).evaluate(element => element === document.activeElement)) {
        findings.push({ width, criterion: 'modal Escape restores trigger focus', observed: 'create trigger is not focused after closing dialog' });
      }
      await page.getByRole('button', { name: 'สร้างโปรเจกต์', exact: true }).click();
      await dialog.waitFor();
      let name = `Director integration ${width} ${Date.now()}`;
      await dialog.locator('input').first().fill(name);
      assert.equal(await dialog.getByRole('button', { name: /^4k/i }).isDisabled(), true);
      await dialog.getByRole('button', { name: 'สร้างและเริ่มใส่ไอเดีย', exact: true }).click();
      await page.getByRole('button', { name: 'ส่งคำขอเดิมอีกครั้ง', exact: true }).first().waitFor();
      const frozenCreate = structuredClone(createBodies[0]);
      assert.equal(await dialog.locator('input').first().isDisabled(), true);
      await page.reload();
      await page.getByRole('button', { name: 'ส่งคำขอเดิมอีกครั้ง', exact: true }).click();
      await page.waitForURL(/\/studio\/director\/[^/]+$/);
      assert.deepEqual(createBodies[1], frozenCreate);
      id = page.url().split('/').pop();
      console.log(`${width}: create/drop/reload/replay passed project=${id}`);
      await page.getByLabel('ไอเดีย', { exact: false }).first().waitFor();
      await page.locator('#idea-prompt').fill('เด็กน้อยออกเดินทางตามหาดวงดาวที่หายไปในป่ามหัศจรรย์');
      await page.getByRole('button', { name: 'อบอุ่น', exact: true }).click();
      await controls({ balance: 0 });
      await page.getByRole('button', { name: /^สร้างภาพปกเรื่อง/ }).click();
      await page.getByRole('alert').filter({ hasText: 'พอยต์ไม่เพียงพอ' }).first().waitFor();
      await page.screenshot({ path: `${artifacts}/insufficient-points-${width}.png`, fullPage: true });
      await controls({ balance: 5000, invalidImage: true });
      await page.getByRole('button', { name: /^สร้างภาพปกเรื่อง/ }).click();
      const failedCover = await eventually(project, value => value.cover?.status === 'failed', 'cover definitive failure');
      assert.equal(failedCover.cover.pointsRefunded, 3);
      assert.equal(failedCover.cover.canRetry, true);
      await controls({ invalidImage: false });
      await page.getByRole('button', { name: /^สร้างภาพปกเรื่อง/ }).click();
      await eventually(project, value => value.cover?.status === 'succeeded', 'cover retry');
      console.log(`${width}: real 402/refund/cover retry passed`);
      await page.getByText('ภาพปกจาก AI', { exact: true }).waitFor();
      const beforeConflict = await project();
      name += ' อีกแท็บ';
      const external = await context.request.patch(`${base}/api/proxy/director/projects/${id}`, { data: { revision: beforeConflict.revision, name } });
      assert.equal(external.status(), 200);
      await page.locator('#idea-prompt').fill('เด็กน้อยออกเดินทางตามหาดวงดาวที่หายไปในป่ามหัศจรรย์ แล้วพบความกล้า');
      await page.getByRole('alert').filter({ hasText: 'มีการแก้ไขจากอีกแท็บ' }).waitFor();
      await page.screenshot({ path: `${artifacts}/revision-conflict-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'ลองบันทึกอีกครั้ง', exact: true }).click();
      await eventually(project, value => value.idea.prompt.endsWith('แล้วพบความกล้า'), 'explicit conflict retry');
      await page.locator('#idea-prompt').fill('เด็กน้อยออกเดินทางตามหาดวงดาว แล้วพบความกล้าและเพื่อนใหม่');
      await page.getByRole('link', { name: 'กลับไปหน้าโปรเจกต์', exact: true }).click();
      await page.waitForURL(`${base}/studio/director`);
      await page.locator(`a[href="/studio/director/${id}"]`).click();
      await page.locator('#idea-prompt').waitFor();
      assert.match(await page.locator('#idea-prompt').inputValue(), /เพื่อนใหม่$/);
      await page.getByRole('button', { name: 'สร้างเนื้อเรื่อง', exact: true }).click();
      let p = await eventually(project, value => value.story.status === 'succeeded', 'story completion');
      assert.equal(p.scenes.length, 3);
      assert.match(p.idea.prompt, /ดวงดาว/);
      await navigateStep('ไอเดีย', 0);
      await page.getByRole('button', { name: 'ลดจำนวนฉาก', exact: true }).click();
      await page.getByRole('button', { name: 'ลดจำนวนฉาก', exact: true }).click();
      await page.getByRole('button', { name: /^ไปที่เนื้อเรื่องเดิม/ }).click();
      await page.locator('section[aria-label="เนื้อเรื่อง"] button[aria-pressed]').first().click();
      await page.getByLabel('ชื่อฉาก', { exact: true }).waitFor();
      assert.match(await page.getByRole('button', { name: /^เขียนฉากนี้ใหม่/ }).innerText(), /2 pt/);
      await page.getByRole('button', { name: /^เขียนฉากนี้ใหม่/ }).click();
      p = await eventually(project, value => value.scenes[0].title === 'ดาวดวงใหม่' && value.scenes[0].status === 'ready', 'scene rewrite');
      let acceptedScene = false, releaseScene;
      const sceneGate = new Promise(resolve => { releaseScene = resolve; });
      const scenePath = `${base}/api/proxy/director/projects/${id}/scenes/${p.scenes[0].id}`;
      const heldScene = async route => {
        if (route.request().method() !== 'PATCH') return route.continue();
        const response = await route.fetch(); acceptedScene = true;
        await sceneGate;
        return route.fulfill({ response });
      };
      await context.route(scenePath, heldScene);
      await page.getByLabel('ชื่อฉาก', { exact: true }).fill('ฉากฉบับที่ส่งบันทึกก่อน');
      await page.getByRole('button', { name: 'ลดจำนวน shot', exact: true }).click();
      await page.getByRole('button', { name: 'บันทึกฉาก', exact: true }).click();
      await eventually(async () => acceptedScene, Boolean, 'scene PATCH accepted before delayed response');
      await page.getByLabel('ชื่อฉาก', { exact: true }).fill('ฉากที่แก้จากหน้าเว็บ');
      releaseScene();
      await eventually(async () => page.getByRole('button', { name: 'บันทึกฉาก', exact: true }).isEnabled(), Boolean, 'new scene edits survive old response');
      assert.equal(await page.getByLabel('ชื่อฉาก', { exact: true }).inputValue(), 'ฉากที่แก้จากหน้าเว็บ');
      if (await page.getByRole('button', { name: 'สร้างสตอรี่บอร์ด', exact: true }).isEnabled()) {
        findings.push({ width, criterion: 'unsaved scene must block storyboard generation', observed: 'generation button enabled with a newer unsaved scene draft' });
        await page.screenshot({ path: `${artifacts}/dirty-scene-finding-${width}.png`, fullPage: true });
      }
      await context.unroute(scenePath, heldScene);
      await page.getByRole('button', { name: 'บันทึกฉาก', exact: true }).click();
      p = await eventually(project, value => value.scenes.some(scene => scene.title === 'ฉากที่แก้จากหน้าเว็บ'), 'scene autosave');
      assert.equal(p.scenes[0].shotCount, 2);
      console.log(`${width}: story/rewrite/late-scene-save passed`);
      await page.screenshot({ path: `${artifacts}/plot-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'สร้างสตอรี่บอร์ด', exact: true }).click();
      await page.locator('#shot-desc').waitFor();
      await page.locator('#shot-desc').fill('คำบรรยายที่แก้ขณะภาพกำลังสร้าง');
      p = await eventually(project, value => value.storyboard.status === 'succeeded', 'storyboard completion');
      assert.equal(p.storyboard.completedImages, 8);
      assert.equal(p.scenes.flatMap(scene => scene.shots).every(shot => shot.image.status === 'succeeded'), true);
      assert.equal(p.scenes[0].shots[0].description, 'คำบรรยายที่แก้ขณะภาพกำลังสร้าง');
      assert.equal(p.scenes[0].shots[0].image.stale, false, 'planning edits are captured before image submission');
      console.log(`${width}: storyboard/planning edit retained in submitted image passed`);
      await page.locator('#shot-desc').waitFor();
      await page.locator('#shot-desc').fill('คำบรรยายใหม่ที่แก้หลังภาพเสร็จแล้ว');
      p = await eventually(project, value => value.scenes.flatMap(scene => scene.shots).some(shot => shot.description === 'คำบรรยายใหม่ที่แก้หลังภาพเสร็จแล้ว' && shot.image.stale), 'shot stale autosave');
      await page.screenshot({ path: `${artifacts}/board-stale-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: /^สร้างภาพใหม่จากคำบรรยายนี้/ }).click();
      p = await eventually(project, value => value.scenes.flatMap(scene => scene.shots).some(shot => shot.description === 'คำบรรยายใหม่ที่แก้หลังภาพเสร็จแล้ว' && !shot.image.stale && shot.image.status === 'succeeded'), 'regenerated image');
      await page.getByRole('button', { name: 'ใช้ภาพนี้เป็นปก', exact: true }).click();
      p = await eventually(project, value => value.cover?.source === 'shot', 'shot cover selection');
      const coveredShot = p.cover.shotId;
      await page.getByRole('button', { name: 'เพิ่ม shot', exact: true }).click();
      p = await eventually(project, value => value.scenes[0].shots.length === 3 && value.scenes[0].shots.every(shot => shot.image.status === 'succeeded'), 'added shot generation');
      await page.getByRole('button', { name: 'ฉาก 1 shot 2', exact: true }).click();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'ลบ shot', exact: true }).click();
      p = await eventually(project, value => value.scenes[0].shots.length === 2, 'shot deletion');
      assert.equal(p.cover.shotId, coveredShot);
      await page.getByRole('button', { name: 'ฉาก 1 shot 1', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: /^สร้างวิดีโอทั้งเรื่อง/ }).isDisabled(), true);
      await page.getByRole('button', { name: 'เล่นสไลด์', exact: true }).click();
      await page.getByRole('dialog', { name: 'เล่นสตอรี่บอร์ด', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await navigateStep('ไอเดีย', 0);
      await page.getByRole('button', { name: 'ใช้ภาพตัวอย่างสไตล์', exact: true }).click();
      p = await eventually(project, value => value.cover === null, 'cover reset');
      await navigateStep('สตอรี่บอร์ด', 2);
      await eventually(project, value => value.step === 'storyboard', 'storyboard navigation persistence');
      await page.reload();
      await page.locator('#shot-desc').waitFor();
      assert.equal(await page.locator('#shot-desc').inputValue(), 'คำบรรยายใหม่ที่แก้หลังภาพเสร็จแล้ว');
      const response = await context.request.get(`${base}/api/proxy/director/projects/${id}`);
      assert.ok(response.headers().etag);
      const conditional = await context.request.get(`${base}/api/proxy/director/projects/${id}`, { headers: { 'If-None-Match': response.headers().etag } });
      assert.equal(conditional.status(), 304);
      assert.equal(await conditional.text(), '');
      assert.equal(conditional.headers().etag, response.headers().etag);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const computed = await page.locator('#shot-desc').evaluate(element => ({ font: getComputedStyle(element).fontFamily, width: getComputedStyle(element).width, border: getComputedStyle(element).border, background: getComputedStyle(element).backgroundColor }));
      await page.screenshot({ path: `${artifacts}/board-${width}.png`, fullPage: true });
      const beforeError = reads.length;
      failMedia = true;
      await page.locator('img[src^="https://owned.test"]').first().evaluate(element => { element.src += '?fixture-expired=1'; });
      await eventually(async () => reads.slice(beforeError), value => value.length > 0, 'expired media unconditional refresh');
      assert.equal(reads.slice(beforeError).every(read => !('if-none-match' in read.headers)), true);
      await page.waitForTimeout(1500);
      const settledReads = reads.length;
      await page.waitForTimeout(4500);
      assert.equal(reads.length, settledReads, 'broken media must not cause a refetch loop');
      assert.deepEqual(errors, []);
      const characters = await characterScenarios(width, p);
      console.log(`${width}: cover/shot/reload/media/character scenarios passed`);
      failMedia = false;
      const capsUnavailable = async route => {
        const response = await route.fetch();
        const payload = await response.json();
        return route.fulfill({ json: { ...payload, data: { ...payload.data, enabled: false, unavailableReason: 'ระบบสร้างเนื้อหาทดสอบยังไม่พร้อม' } } });
      };
      await context.route(`${base}/api/proxy/director/capabilities`, capsUnavailable);
      await page.reload();
      await page.getByText('ระบบสร้างเนื้อหาทดสอบยังไม่พร้อม', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: /^สร้างภาพใหม่จากคำบรรยายนี้/ }).isDisabled(), true);
      await page.screenshot({ path: `${artifacts}/unavailable-${width}.png`, fullPage: true });
      await context.unroute(`${base}/api/proxy/director/capabilities`, capsUnavailable);
      await page.getByRole('link', { name: 'กลับไปหน้าโปรเจกต์', exact: true }).click();
      await page.getByRole('textbox', { name: 'ค้นหาโปรเจกต์', exact: true }).fill(name);
      await page.getByRole('heading', { name, exact: true }).waitFor();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: `ลบ ${name}`, exact: true }).click();
      await page.getByRole('heading', { name: 'ไม่พบโปรเจกต์', exact: true }).waitFor();
      assert.equal((await context.request.get(`${base}/api/proxy/director/projects/${id}`)).status(), 404);
      observations.push({ width, id, computed, errors, consoleErrors, network, reads, createBodies, characters, boundary: 'Next production + real Go/isolated PostgreSQL; fake analysis/image/storage/auth, injected broken media and one network disconnect after real create acceptance' });
    } catch (error) {
      await page.screenshot({ path: `${artifacts}/failure-${width}.png`, fullPage: true }).catch(() => {});
      fs.writeFileSync(`${artifacts}/failure-${width}.json`, JSON.stringify({ error: error.stack, errors, consoleErrors, network }, null, 2));
      throw error;
    } finally {
      if (id) await context.request.delete(`${base}/api/proxy/director/projects/${id}`);
      await context.close();
    }
  }
  const status = findings.length ? 'FAIL' : 'PASS';
  fs.writeFileSync(`${artifacts}/results.json`, JSON.stringify({ status, base, observations, findings }, null, 2));
  console.log(JSON.stringify({ status, viewports: observations.map(item => item.width), artifacts, findings }));
  assert.deepEqual(findings, [], 'confirmed product findings must be fixed before acceptance');
} finally {
  await browser?.close();
}
