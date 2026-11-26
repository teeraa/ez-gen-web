// Phase 6 browser check: positions "ฉาก N · ช็อต M", free ask-back, scene scope, confirmation card.
// Runs against `next start` with the film API mocked in the browser (route interception); the
// server-side session check needs API_URL pointing at a stub answering /api/v1/auth/me.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:3100';
const out = process.env.OUT || '/tmp/film-positions-browser';
fs.mkdirSync(out, { recursive: true });
const series = '11111111-1111-4111-8111-111111111111';
const project = '22222222-2222-4222-8222-222222222222';
const hero = { id: 'e1', seriesId: series, kind: 'character', name: 'ขุนอินทร์', spec: 'officer', revision: 1, imageStatus: 'succeeded', imageUrl: null, imageExpiresAt: null, syntheticUrl: null, prepared: true, updatedAt: '2026-11-23T00:00:00Z', voice: { voiceId: 'nara', voiceName: 'นารา', kind: 'preset', emotion: 'ปกติ', speed: 1 } };
const camp = { ...hero, id: 'e2', kind: 'location', name: 'แนวค่าย', voice: null };
const clip = { status: 'succeeded', progress: 100, url: null, expiresAt: null, stale: false, modelId: 'm', seconds: 5, mode: 'reference', pointsCharged: 10, pointsRefunded: 0, draft: false, canFinalize: false, voice: 'current', voiceMessage: null, rawUrl: null, lines: [], failureMessage: null };
const shot = (id, transition, action, video = null) => ({ id, index: 0, seconds: 5, start: 0, transition, characterIds: ['e1'], locationId: 'e2', propIds: [], action, camera: '', dialogue: [], audio: '', video, trimIn: 0, trimOut: 0, lineAt: [] });
let ep = {
  projectId: project, seriesId: series, episodeNumber: 1, episodeTitle: 'ศึก', revision: 3, style: 'anime', aspectRatio: '16:9', resolution: '720p', filmed: false, totalSeconds: 20,
  shots: [shot('s1', 'cut', 'a1'), shot('s2', 'continue', 'a2'), shot('s3', 'cut', 'a3', clip), shot('s4', 'continue', 'a4')],
  elements: [hero, camp], videoModels: [{ id: 'm', label: 'Seedance', minSeconds: 4, maxSeconds: 15, audio: true, default: true, draft: false }],
  imagePoints: 2, videoPointsPer5s: 10, draftPointsPer5s: 0, balance: 90, planPoints: 8, planAvailable: true, targetSeconds: 20,
  story: { title: 'ศึก', logline: '', synopsis: '', theme: '' }, messages: [], plan: null, export: null, exportAvailable: true,
  redubShots: 0, redubPoints: 0, redubAvailable: true, music: null, pending: null,
};
const posts = [];
const errors = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
await context.addCookies([{ name: 'ezgen_session', value: 'qa', url: base }]);
await context.route('**/api/proxy/**', async (route) => {
  const r = route.request();
  const path = new URL(r.url()).pathname.replace('/api/proxy/', '');
  const ok = (payload, status = 200) => route.fulfill({ status, json: { success: true, payload } });
  if (path === `film/episodes/${project}` && r.method() === 'GET') return ok(ep);
  if (path === `film/episodes/${project}/plan`) {
    const body = r.postDataJSON(); posts.push({ path, body });
    const at = '2026-11-23T10:00:00Z';
    const target = body.shotId ? (body.scope === 'scene' ? 'ฉาก 2' : 'ฉาก 1 · ช็อต 2') : '';
    if (!body.shotId && !/ฉาก\s*\d/.test(body.prompt)) {
      ep = { ...ep, messages: [...ep.messages, { role: 'user', text: body.prompt, shotId: '', target: '', at }, { role: 'assistant', text: 'ต้องการแก้ตรงไหนครับ? ระบุเป็น “ฉาก N · ช็อต M” · ยังไม่คิดแต้ม', shotId: '', target: '', at }] };
      return ok(ep, 202);
    }
    // The assistant proposes deleting ฉาก 2 · ช็อต 1 (paid clip) and a voice change: confirmation card.
    ep = { ...ep, messages: [...ep.messages, { role: 'user', text: body.prompt, shotId: body.shotId ?? '', target, at }, { role: 'assistant', text: 'ลบช็อตและเปลี่ยนเสียงแล้ว · รอยืนยันก่อนแก้', shotId: '', target, at }],
      pending: { id: '33333333-3333-4333-8333-333333333333', reply: 'ok', summary: 'ลบ ฉาก 2 · ช็อต 1 · เปลี่ยน เสียงของ @ขุนอินทร์', deletes: ['ฉาก 2 · ช็อต 1'], voices: [{ name: 'ขุนอินทร์', voice: 'กฤต', redubClips: 1, remakeClips: 1 }], redubPoints: 1, videoPoints: 11, stale: 1, createdAt: at } };
    return ok(ep, 202);
  }
  if (path === `film/episodes/${project}/plan/confirm`) {
    const body = r.postDataJSON(); posts.push({ path, body });
    const at = '2026-11-23T10:01:00Z';
    ep = body.accept
      ? { ...ep, pending: null, shots: [ep.shots[0], ep.shots[1], { ...ep.shots[3], transition: 'cut' }], messages: [...ep.messages, { role: 'assistant', text: 'ยืนยันแล้ว · ลบ ฉาก 2 · ช็อต 1', shotId: '', target: '', at }] }
      : { ...ep, pending: null, messages: [...ep.messages, { role: 'assistant', text: 'ยกเลิกการแก้ไขแล้ว ไม่มีอะไรเปลี่ยน', shotId: '', target: '', at }] };
    return ok(ep);
  }
  return route.fulfill({ status: 404, json: { success: false, message: 'unmocked ' + path } });
});
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/studio/film/${series}/${project}`);
const chat = page.locator('#film-chat');
await chat.waitFor({ timeout: 30000 });
assert.match(await chat.getAttribute('placeholder'), /ฉาก 2 · ช็อต 1/);

// 1. No position: the composer warns, the server asks back for free.
await chat.fill('ทำให้ทั้งเรื่องเศร้าขึ้น');
await page.getByText('ยังไม่ได้ระบุ “ฉาก N · ช็อต M”').waitFor();
await chat.press('Enter');
await page.getByText('ต้องการแก้ตรงไหนครับ?').waitFor();
assert.equal(posts[0].body.shotId, undefined);
await page.screenshot({ path: `${out}/1-ask-back.png` });

// 2. Studio: inspector shows "ฉาก 1 · ช็อต 2"; select it for chat, switch to the whole scene.
await page.locator('[aria-label="รายละเอียดฉาก 1 ช็อต 1"]').waitFor();
await page.getByRole('button', { name: 'ฉาก 1 · ช็อต 2' }).first().click().catch(async () => {
  // Fallback: select the second clip in the timeline by its label.
  await page.locator('[aria-label*="ช็อต 2"]').first().click();
});
await page.locator('[aria-label^="รายละเอียดฉาก 1 ช็อต 2"]').waitFor();
await page.getByRole('button', { name: 'แก้ช็อตนี้ด้วยแชต' }).click();
await page.locator('form').getByText('ฉาก 1 · ช็อต 2', { exact: true }).waitFor();
await page.getByRole('radio', { name: 'ทั้งฉาก' }).click();
await page.locator('form').getByText('แก้เฉพาะฉาก 1 ฉากอื่นไม่เปลี่ยน').waitFor();
assert.match(await page.locator('form small').innerText(), /แก้ทั้งฉาก 8 แต้ม/);
await page.getByRole('radio', { name: 'ช็อตนี้' }).click();
assert.match(await page.locator('form small').innerText(), /แก้ช็อต 2 แต้ม/);
await page.getByRole('radio', { name: 'ทั้งฉาก' }).click();
await chat.fill('ลบฉาก 2 · ช็อต 1 และเปลี่ยนเสียงขุนอินทร์ให้ทุ้ม');
await page.screenshot({ path: `${out}/2-target-scene.png` });
await chat.press('Enter');

// 3. Confirmation card with the deleted position, the voice change and the price.
const card = page.getByRole('group', { name: 'ยืนยันการแก้ไข' });
await card.waitFor();
assert.equal(posts[1].body.scope, 'scene');
assert.equal(posts[1].body.shotId, 's2');
const text = await card.innerText();
assert.match(text, /คลิปที่จ่ายแต้มไปแล้วจะหายไป: ฉาก 2 · ช็อต 1/);
assert.match(text, /@ขุนอินทร์ → กฤต · พากย์ใหม่ 1 คลิป · สร้างวิดีโอใหม่ 1 คลิป/);
assert.match(text, /ใช้ 12 แต้ม/);
await page.screenshot({ path: `${out}/3-confirm-card.png` });
await card.getByRole('button', { name: /ยืนยัน · 12 แต้ม/ }).click();
await page.getByText('ยืนยันแล้ว · ลบ ฉาก 2 · ช็อต 1').waitFor();
assert.equal(await card.count(), 0);
assert.equal(posts[2].body.accept, true);
assert.match(posts[2].body.idempotencyKey, /^[0-9a-f-]{36}$/);
// User messages carry the position label they were about.
assert.ok(await page.locator('span', { hasText: /^ฉาก 2$/ }).count() >= 1);
await page.screenshot({ path: `${out}/4-confirmed.png` });

await browser.close();
assert.deepEqual(errors, []);
console.log('PASS', posts.map((p) => p.path.split('/').pop()).join(','));
