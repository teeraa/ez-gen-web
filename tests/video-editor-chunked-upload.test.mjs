import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadInChunks, EditorApiError} from '../src/lib/video-editor-api.ts';

const MB = 1024 * 1024;
function fakeServer({failOnce = new Set(), dropOnComplete = []} = {}) {
  const state = {chunks: new Map(), calls: [], completes: 0, deleted: false};
  const fetcher = async (url, init = {}) => {
    state.calls.push(`${init.method} ${url}`);
    if (init.method === 'POST' && url.endsWith('/uploads')) {
      const body = JSON.parse(init.body);
      return Response.json({success:true,payload: {uploadId: 'u1', chunkSize: 5 * MB, chunks: Math.ceil(body.size / (5 * MB)), size: body.size}}, {status: 201});
    }
    const chunk = url.match(/chunks\/(\d+)$/);
    if (chunk) {
      const index = Number(chunk[1]);
      if (failOnce.has(index)) {failOnce.delete(index); return Response.json({success: false, message: 'x', payload: {errorCode: 'STORAGE_UNAVAILABLE'}}, {status: 503});}
      state.chunks.set(index, (await init.body.arrayBuffer()).byteLength);
      return Response.json({success:true,payload: {received: state.chunks.size}});
    }
    if (url.endsWith('/complete')) {
      state.completes++;
      const drop = dropOnComplete.shift();
      if (drop !== undefined) {state.chunks.delete(drop); return Response.json({success: false, message: 'missing', payload: {errorCode: 'UPLOAD_INCOMPLETE', details: {missing: [drop]}}}, {status: 409});}
      return Response.json({success:true,payload: {id: 'a1', status: 'processing', clientUploadId: 'c1'}}, {status: 201});
    }
    if (init.method === 'DELETE') {state.deleted = true; return Response.json({success:true,payload: {aborted: true}});}
    return Response.json({success: false, message: url, payload: {errorCode: 'NOT_FOUND'}}, {status: 404});
  };
  return {state, fetcher};
}
const file = (size) => new File([new Uint8Array(size)], 'screen.mov', {type: 'video/quicktime'});

test('uploads every chunk with retry, resends what the server is missing, returns the asset', async () => {
  const {state, fetcher} = fakeServer({failOnce: new Set([1]), dropOnComplete: [2]});
  const progress = [];
  const media = await uploadInChunks('p1', 'c1', file(12 * MB + 7), value => progress.push(value), new AbortController().signal, fetcher);
  assert.equal(media.status, 'processing');
  assert.deepEqual([...state.chunks.keys()].sort(), [0, 1, 2]);
  assert.equal(state.chunks.get(2), 2 * MB + 7, 'last chunk is the remainder');
  assert.equal(state.completes, 2, 'complete retried after resending the missing chunk');
  assert.equal(progress.at(-1), 100);
  assert.ok(state.calls[0].startsWith('POST /api/proxy/video-editor/projects/p1/uploads'));
});

test('a refused upload frees the server session and keeps the server message', async () => {
  const fetcher = async (url, init = {}) => {
    if (url.endsWith('/uploads')) return Response.json({success:true,payload: {uploadId: 'u1', chunkSize: 5 * MB, chunks: 1, size: 10}}, {status: 201});
    if (init.method === 'DELETE') {fetcher.deleted = true; return Response.json({success:true,payload: {}})}
    return Response.json({success: false, message: 'ส่วนของไฟล์ไม่ถูกต้อง', payload: {errorCode: 'VALIDATION_ERROR'}}, {status: 422});
  };
  await assert.rejects(uploadInChunks('p1', 'c1', file(10), () => {}, new AbortController().signal, fetcher), error => error instanceof EditorApiError && error.message === 'ส่วนของไฟล์ไม่ถูกต้อง');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(fetcher.deleted, true);
});
