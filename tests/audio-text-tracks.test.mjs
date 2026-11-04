import test from 'node:test';
import assert from 'node:assert/strict';
import { activeAudioAt, adjustAudioClip, adjustTextLayer, audioClipRange, clampedTextBox, hasForbiddenText, incomingTracks, keepPendingExport, limitText, mediaKindOf, newTextLayer, normaliseAudioClips, normaliseTextLayers, parseNumberInput, sanitizeText, saveRequestBody, textPlacement, textShadow, trackProblem, transformTextGeometry } from '../src/components/ai-editor/tracks.ts';
import { buildSubtitleLayers, captionCards, graphemes, wrapLines, isSubtitleId, mapTranscriptsToTimeline, subtitleId, transcriptSegmentText } from '../src/components/ai-editor/subtitles.ts';

const uuid = () => crypto.randomUUID();

test('media kind detection separates audio uploads from video uploads', () => {
  assert.equal(mediaKindOf({ name: 'song.MP3', type: '' }), 'audio');
  assert.equal(mediaKindOf({ name: 'voice.m4a', type: 'audio/x-m4a' }), 'audio');
  assert.equal(mediaKindOf({ name: 'take.wav', type: 'audio/wav' }), 'audio');
  assert.equal(mediaKindOf({ name: 'clip.mp4', type: 'video/mp4' }), 'video');
  assert.equal(mediaKindOf({ name: 'notes.txt', type: 'text/plain' }), undefined);
});

test('new audio clip uses the full source at the playhead and is bounded by limits', () => {
  assert.deepEqual(audioClipRange(12.34, 90, 0, 20), { at: 12.34, start: 0, end: 90 });
  assert.deepEqual(audioClipRange(1150, 90, 0, 20), { at: 1150, start: 0, end: 50 });
  assert.equal(audioClipRange(0, 90, 20, 20), undefined);
  assert.equal(audioClipRange(1200, 90, 0, 20), undefined);
  assert.equal(audioClipRange(0, NaN, 0, 20), undefined);
});

test('audio clip edits stay inside source, timeline and volume ranges', () => {
  const clip = { id: 'a', assetId: 's', at: 10, start: 2, end: 8, volume: 1 };
  assert.equal(adjustAudioClip(clip, 'end', 99, 30).end, 30);
  assert.equal(adjustAudioClip(clip, 'start', 9, 30).start, 7.9);
  assert.equal(adjustAudioClip(clip, 'volume', 3, 30).volume, 1);
  assert.equal(adjustAudioClip(clip, 'at', -5, 30).at, 0);
  assert.equal(adjustAudioClip(clip, 'at', 1199, 30).at, 1194);
  assert.equal(adjustAudioClip(clip, 'at', NaN, 30), undefined);
});

test('active audio follows the timeline and never plays past the video total', () => {
  const clips = [{ id: 'a', at: 2, start: 5, end: 15 }, { id: 'b', at: 20, start: 0, end: 5 }];
  assert.deepEqual(activeAudioAt(clips, 4, 30).map(item => [item.clip.id, item.source]), [['a', 7]]);
  assert.deepEqual(activeAudioAt(clips, 12.5, 30), []);
  assert.deepEqual(activeAudioAt(clips, 21, 20.5).map(item => item.clip.id), []);
  assert.deepEqual(activeAudioAt(clips, 20.2, 20.5).map(item => item.until), [20.5]);
});

test('text layer defaults, limits and placement match the contract', () => {
  const layer = newTextLayer('t', 4, 30);
  assert.deepEqual({ ...layer, id: undefined }, { id: undefined, text: 'ข้อความ', start: 4, end: 7, x: .5, y: .85, fontSize: 48, color: '#FFFFFF', align: 'center' });
  assert.equal(newTextLayer('t', 30, 30).start, 27);
  assert.equal(limitText('1\n2\n3\n4\n5\n6\n7'), '1\n2\n3\n4\n5\n6');
  assert.equal(Array.from(limitText('ก'.repeat(600))).length, 500);
  assert.equal(adjustTextLayer(layer, 'fontSize', 400).fontSize, 200);
  assert.equal(adjustTextLayer(layer, 'color', '#abcdef').color, '#ABCDEF');
  assert.equal(adjustTextLayer(layer, 'color', 'red'), undefined);
  assert.equal(adjustTextLayer(layer, 'end', 1).end, 4.1);
  const place = textPlacement({ x: .25, y: .85, fontSize: 54, align: 'left' }, 540);
  assert.deepEqual(place, { left: '25%', top: '85%', fontSize: 27, transform: 'translate(-50%, -50%)', textAlign: 'left' });
  assert.equal(textPlacement({ x: .5, y: .5, fontSize: 48, align: 'right' }, 1080).transform, 'translate(-50%, -50%)');
  assert.equal(textPlacement({ x: .5, y: .5, fontSize: 48, align: 'center' }, 853).fontSize, 38);
});

test('pre-save validation rejects blank text and over-limit tracks', () => {
  const layer = newTextLayer('t', 0, 10);
  assert.equal(trackProblem([], [layer], 20, 50), '');
  assert.match(trackProblem([], [{ ...layer, text: '  ' }], 20, 50), /ว่าง/);
  assert.match(trackProblem([], Array.from({ length: 51 }, () => layer), 20, 50), /50/);
  assert.match(trackProblem([{ id: 'a', assetId: 's', at: 1195, start: 0, end: 10, volume: 1 }], [], 20, 50), /ไม่ถูกต้อง/);
});

test('legacy or malformed server tracks normalise to safe arrays', () => {
  assert.deepEqual(normaliseAudioClips(undefined), []);
  assert.deepEqual(normaliseTextLayers(null), []);
  assert.deepEqual(normaliseAudioClips([{ id: 'a', assetId: 's', at: 1, start: 0, end: 2 }, { id: 'bad' }]), [{ id: 'a', assetId: 's', at: 1, start: 0, end: 2, volume: 1 }]);
  assert.equal(normaliseTextLayers([{ id: 't', text: 'x', start: 0, end: 1, color: '#ff0000', align: 'weird' }])[0].align, 'center');
});

const transcript = {
  assetId: 'A',
  segments: [{ start: 1, end: 3, text: 'ต้นฉบับหนึ่ง' }, { start: 5, end: 9, text: 'ต้นฉบับสอง' }, { start: 20, end: 22, text: '  ' }],
  refinement: { segments: [{ segmentIndex: 0, text: 'เรียบเรียงหนึ่ง', uncertain: false }, { segmentIndex: 1, text: 'ต้นฉบับสอง', uncertain: true }, { segmentIndex: 2, text: 'x', uncertain: true }] },
};

test('subtitle text prefers refinement and falls back to the original when uncertain', () => {
  assert.equal(transcriptSegmentText(transcript, 0), 'เรียบเรียงหนึ่ง');
  assert.equal(transcriptSegmentText(transcript, 1), 'ต้นฉบับสอง');
  assert.equal(transcriptSegmentText({ ...transcript, refinement: null }, 0), 'ต้นฉบับหนึ่ง');
});

test('transcript segments map onto every timeline segment that uses the asset', () => {
  // Timeline: A[0,4) at 0, B at 4, A[6,10) at 10 (source re-used).
  const timeline = [{ asset: 'A', start: 0, end: 4, at: 0 }, { asset: 'B', start: 0, end: 6, at: 4 }, { asset: 'A', start: 6, end: 10, at: 10 }];
  const cues = mapTranscriptsToTimeline([transcript], timeline);
  assert.deepEqual(cues, [
    { text: 'เรียบเรียงหนึ่ง', start: 1, end: 3 },
    { text: 'ต้นฉบับสอง', start: 10, end: 13 },
  ]);
  const { layers, dropped } = buildSubtitleLayers([transcript], timeline, { ratio: 9 / 16, capacity: 50, makeId: uuid });
  assert.equal(dropped, 0);
  assert.equal(layers.length, 2);
  for (const layer of layers) {
    assert.ok(isSubtitleId(layer.id));
    assert.match(layer.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.equal(layer.y, .86);
    assert.equal(layer.align, 'center');
  }
});

test('long captions split into ≤2-line cards with proportional timing, and capacity is respected', () => {
  const long = 'สวัสดีครับวันนี้เราจะมาแนะนำร้านกาแฟเล็กๆ ที่อยู่ใจกลางเมือง บรรยากาศดีมาก กาแฟหอม ขนมอร่อย และราคาไม่แพงเลย';
  const cards = captionCards(long, 0, 10, 20);
  assert.ok(cards.length >= 2);
  for (const card of cards) { assert.ok(card.text.split('\n').length <= 2); for (const line of card.text.split('\n')) assert.ok(graphemes(line).length <= 20, line); }
  assert.equal(cards[0].start, 0); assert.equal(cards.at(-1).end, 10);
  for (let index = 1; index < cards.length; index++) assert.equal(cards[index].start, cards[index - 1].end);
  const many = { assetId: 'A', segments: Array.from({ length: 60 }, (_, index) => ({ start: index, end: index + .9, text: `ประโยค ${index}` })) };
  const result = buildSubtitleLayers([many], [{ asset: 'A', start: 0, end: 60, at: 0 }], { ratio: 16 / 9, capacity: 45, makeId: uuid });
  assert.equal(result.layers.length, 45); assert.equal(result.dropped, 15);
});

test('subtitle id marker stays a valid UUID', () => {
  const id = subtitleId('123e4567-e89b-42d3-a456-426614174000');
  assert.equal(id, '123e4567-e89b-42d3-a456-5ab71e174000');
  assert.ok(isSubtitleId(id));
  assert.equal(isSubtitleId('123e4567-e89b-42d3-a456-426614174000'), false);
});

test('audio start edits keep the clip inside the 1200 s timeline', () => {
  const clip = { id: 'a', assetId: 's', at: 1190, start: 20, end: 25, volume: 1 };
  const next = adjustAudioClip(clip, 'start', 0, 60);
  assert.equal(next.start, 15);
  assert.ok(next.at + next.end - next.start <= 1200);
  assert.equal(adjustAudioClip({ ...clip, at: 0 }, 'start', 0, 60).start, 0);
});

test('text sanitisation removes everything the server rejects', () => {
  assert.equal(sanitizeText('a\tb\r\nc\rd'), 'a b\nc\nd');
  assert.equal(sanitizeText('x\u0000\u0007\u001B\u007F\u0085y'), 'xy');
  assert.equal(sanitizeText('\u202Aa\u202E\u2066b\u2069\u200Bc\u200C\u200D\u2060\uFEFFd\u2028e\u2029f'), 'abcdef');
  assert.equal(sanitizeText('สวัสดี 👋\nบรรทัดสอง'), 'สวัสดี 👋\nบรรทัดสอง');
  assert.equal(limitText('a\tb\u200Bc'), 'a bc');
  assert.equal(adjustTextLayer(newTextLayer('t', 0, 10), 'text', 'x\u202Ey\u0001').text, 'xy');
  for (const bad of ['a\tb', 'a\rb', 'a\u0001', 'a\u202Bb', 'a\u2067b', 'a\uFEFFb', 'a\u2028b', 'a\u200Db']) {
    assert.equal(hasForbiddenText(bad), true, JSON.stringify(bad));
    assert.match(trackProblem([], [{ ...newTextLayer('t', 0, 10), text: bad }], 20, 50), /อักขระ/);
  }
  assert.equal(hasForbiddenText('ไทย\nok'), false);
});

test('number input ignores empty or partial text', () => {
  assert.equal(parseNumberInput(''), undefined);
  assert.equal(parseNumberInput('  '), undefined);
  assert.equal(parseNumberInput('-'), undefined);
  assert.equal(parseNumberInput('abc'), undefined);
  assert.equal(parseNumberInput('0'), 0);
  assert.equal(parseNumberInput('12.5'), 12.5);
});

test('save body includes tracks only for track-capable backends', () => {
  const snapshot = { title: '  Demo ', ratio: '9/16', segments: [{ id: 's1', asset: 'a1', start: 0, end: 4, volume: 1 }], audioClips: [{ id: 'c', assetId: 'm', at: 1, start: 0, end: 2, volume: .5 }], textLayers: [{ ...newTextLayer('t', 0, 10), text: '  สวัสดี  ' }] };
  const withTracks = saveRequestBody(snapshot, 7, true);
  assert.deepEqual(withTracks.segments, [{ id: 's1', assetId: 'a1', start: 0, end: 4, volume: 1 }]);
  assert.equal(withTracks.revision, 7);
  assert.equal(withTracks.title, 'Demo');
  assert.equal(withTracks.aspectRatio, '9:16');
  assert.deepEqual(withTracks.audioClips, snapshot.audioClips);
  assert.equal(withTracks.textLayers[0].text, 'สวัสดี');
  const legacy = saveRequestBody(snapshot, 7, false);
  assert.equal('audioClips' in legacy, false);
  assert.equal('textLayers' in legacy, false);
});

test('omitted track fields keep local values only for the same track-capable project', () => {
  const local = [{ id: 'x' }];
  const identity = value => Array.isArray(value) ? value : [];
  assert.equal(incomingTracks(undefined, local, true, identity), local);
  assert.equal(incomingTracks(null, local, true, identity), local);
  assert.deepEqual(incomingTracks(undefined, local, false, identity), []);
  assert.deepEqual(incomingTracks([], local, true, identity), []);
  assert.deepEqual(normaliseAudioClips(incomingTracks(undefined, [], false, normaliseAudioClips)), []);
});

test('stored export request is replayed only after a network failure or malformed 2xx', () => {
  assert.equal(keepPendingExport(new TypeError('Failed to fetch')), true);
  assert.equal(keepPendingExport({ status: 200, code: 'INVALID_RESPONSE' }), true);
  assert.equal(keepPendingExport({ status: 503, code: 'MEDIA_UNAVAILABLE' }), false);
  assert.equal(keepPendingExport({ status: 500, code: 'REQUEST_FAILED' }), false);
  assert.equal(keepPendingExport({ status: 409, code: 'REVISION_CONFLICT' }), false);
});

test('preview text shadow and frame clamp mirror export drawtext', () => {
  assert.equal(textShadow(1080), '2px 2px 0 rgba(0,0,0,.6)');
  assert.equal(textShadow(540), '1px 1px 0 rgba(0,0,0,.6)');
  assert.equal(textShadow(270), '1px 1px 0 rgba(0,0,0,.6)');
  assert.equal(textShadow(1920), '4px 4px 0 rgba(0,0,0,.6)');
  assert.equal(textShadow(853), '2px 2px 0 rgba(0,0,0,.6)');
  const frame = { width: 300, height: 600 };
  assert.deepEqual(clampedTextBox({ x: .5, y: .5, align: 'center' }, { width: 100, height: 40 }, frame), { left: 100, top: 280 });
  assert.deepEqual(clampedTextBox({ x: 0, y: 0, align: 'center' }, { width: 100, height: 40 }, frame), { left: 0, top: 0 });
  assert.deepEqual(clampedTextBox({ x: 1, y: 1, align: 'left' }, { width: 100, height: 40 }, frame), { left: 200, top: 560 });
  assert.deepEqual(clampedTextBox({ x: .2, y: .5, align: 'right' }, { width: 100, height: 40 }, frame), { left: 10, top: 280 });
  // align does not move the anchor: (x, y) is always the box centre.
  for (const align of ['left', 'center', 'right']) assert.deepEqual(clampedTextBox({ x: .4, y: .25, align }, { width: 60, height: 40 }, frame), { left: 90, top: 130 });
  assert.deepEqual(clampedTextBox({ x: .5, y: .5, align: 'center' }, { width: 400, height: 40 }, frame), { left: 0, top: 280 });
});

test('subtitle wrapping never starts a line with a Thai combining mark', () => {
  const combining = /^[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/u;
  assert.deepEqual(graphemes('กิ่ง'), ['กิ่', 'ง']);
  const text = 'ที่นี่มีน้ำใสสะอาดและต้นไม้เขียวขจีทั่วทั้งบริเวณ';
  for (const width of [3, 4, 5, 7, 10]) {
    const lines = wrapLines(text, width);
    assert.equal(lines.join(''), text);
    for (const line of lines) {
      assert.equal(combining.test(line), false, `${width}: ${JSON.stringify(lines)}`);
      assert.ok(graphemes(line).length <= width, `${width}: ${line}`);
    }
  }
  assert.deepEqual(wrapLines('น้ำน้ำน้ำ', 2), ['น้ำน้ำ'.slice(0, 6), 'น้ำ']);
});


test('stage gestures move a scaled text box inside the frame and resize axes independently', () => {
  const layer = { x: .5, y: .5 };
  const box = { width: 100, height: 40 }, frame = { width: 400, height: 200 };
  assert.deepEqual(transformTextGeometry(layer, box, frame, 40, 20, 'move'), { x: .6, y: .6, scaleX: 1, scaleY: 1 });
  assert.deepEqual(transformTextGeometry(layer, box, frame, 25, 50, 'width'), { x: .5, y: .5, scaleX: 1.5, scaleY: 1 });
  assert.deepEqual(transformTextGeometry(layer, box, frame, 25, 10, 'height'), { x: .5, y: .5, scaleX: 1, scaleY: 1.5 });
  const edge = transformTextGeometry(layer, box, frame, 1000, -1000, 'move');
  assert.deepEqual(edge, { x: .875, y: .1, scaleX: 1, scaleY: 1 });
  assert.deepEqual(transformTextGeometry(layer, box, frame, 1000, 1000, 'both'), { x: .5, y: .5, scaleX: 4, scaleY: 5 });
});
test('text resize survives save/normalization and invalid scales fail before save', () => {
  const base = newTextLayer('t1', 0, 10);
  const scaled = { ...base, scaleX: 1.75, scaleY: .6 };
  assert.deepEqual(normaliseTextLayers([scaled]), [scaled]);
  assert.equal(trackProblem([], [{...base, scaleX: NaN}], 20, 50), 'ขนาดข้อความไม่ถูกต้อง');
  assert.equal(adjustTextLayer(base, 'scaleX', 20).scaleX, 5);
  assert.equal(adjustTextLayer(base, 'scaleY', 0).scaleY, .1);
  const body = saveRequestBody({ title: 'T', ratio: '16/9', segments: [], audioClips: [], textLayers: [scaled] }, 1, true);
  assert.deepEqual(body.textLayers[0], scaled);
});

test('AI ownership survives project normalization and save while manual tracks stay unowned',()=>{
 const originJobId='da49c216-075b-49b4-b695-5e1633d02763';
 const layer={...newTextLayer('text',0,10),originJobId};const audio={id:'a',assetId:'music',at:0,start:0,end:3,volume:.3,originJobId};
 assert.equal(normaliseTextLayers([layer])[0].originJobId,originJobId);assert.equal(normaliseAudioClips([audio])[0].originJobId,originJobId);
 assert.equal(normaliseTextLayers([{...layer,originJobId:'bad'}])[0].originJobId,undefined);
 const saved=saveRequestBody({title:'T',ratio:'16/9',segments:[],audioClips:normaliseAudioClips([audio]),textLayers:normaliseTextLayers([layer])},1,true);
 assert.equal(saved.textLayers[0].originJobId,originJobId);assert.equal(saved.audioClips[0].originJobId,originJobId);
});
