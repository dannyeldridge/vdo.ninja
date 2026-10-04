// echobend/tests/sfu.test.mjs: run with `node --test tests/` from echobend/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playPath, parsePlay } from '../../functions/_lib/sfu.js';
import { onRequest as publish } from '../../functions/start/sfu/publish/[[path]].js';
import { onRequest as play } from '../../functions/sfu/play/[[path]].js';

const env = { REALTIME_APP_ID: 'app', REALTIME_API_TOKEN: 'tok' };
const OFFER = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n';
// Stub fetch: answer by URL suffix, record calls.
function stub(routes) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find(k => url.endsWith(k));
    const [status, json] = routes[key] || [404, { errorCode: 'not_found', errorDescription: 'no route' }];
    return new Response(JSON.stringify(json), { status });
  };
  return calls;
}
const req = (url, method = 'POST', body = OFFER) => new Request(url, { method, body: method === 'POST' ? body : undefined });
const ctx = (request, path) => ({ request, env, params: { path } });

test('playPath and parsePlay round-trip', () => {
  const p = playPath('abc123', ['t1', 't2']);
  assert.equal(p, '/sfu/play/abc123/t1.t2');
  assert.deepEqual(parsePlay(['abc123', 't1.t2']), { sessionId: 'abc123', trackNames: ['t1', 't2'] });
});

test('parsePlay rejects bad input', () => {
  assert.equal(parsePlay([]), null);
  assert.equal(parsePlay(['abc']), null);
  assert.equal(parsePlay(['a/b', 't1']), null);
  assert.equal(parsePlay(['abc', 't1.t2.t3.t4.t5']), null);
  assert.equal(parsePlay(['abc', 't1..t2']), null);
});

test('publish returns answer, location and whep header', async () => {
  const calls = stub({
    '/sessions/new': [201, { sessionId: 'PUB' }],
    '/sessions/PUB/tracks/new': [200, { tracks: [{ trackName: 'ta', mid: '0' }, { trackName: 'tv', mid: '1' }], sessionDescription: { type: 'answer', sdp: 'ANSWER' } }],
  });
  const r = await publish(ctx(req('https://live.echobend.com/start/sfu/publish/ebabc'), ['ebabc']));
  assert.equal(r.status, 201);
  assert.equal(await r.text(), 'ANSWER');
  assert.equal(r.headers.get('content-type'), 'application/sdp');
  assert.equal(r.headers.get('whep'), 'https://live.echobend.com/sfu/play/PUB/ta.tv');
  assert.match(r.headers.get('access-control-expose-headers'), /whep/);
  assert.equal(calls[0].init.body, undefined);               // sessions/new must have no body
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(calls[1].init.body), { sessionDescription: { type: 'offer', sdp: OFFER }, autoDiscover: true });
});

test('publish rejects bad sid and non-SDP bodies', async () => {
  stub({});
  assert.equal((await publish(ctx(req('https://x/start/sfu/publish/a%2Fb'), ['a/b']))).status, 400);
  assert.equal((await publish(ctx(req('https://x/start/sfu/publish/eb1', 'POST', 'hello'), ['eb1']))).status, 400);
});

test('publish reports SFU failure as 502', async () => {
  stub({ '/sessions/new': [401, { errorCode: 'unauthorized', errorDescription: 'Invalid bearer token' }] });
  const r = await publish(ctx(req('https://x/start/sfu/publish/eb1'), ['eb1']));
  assert.equal(r.status, 502);
  assert.match(await r.text(), /Invalid bearer token/);
});

test('publish acknowledges DELETE and PATCH', async () => {
  stub({});
  assert.equal((await publish(ctx(req('https://x/start/sfu/publish/eb1/PUB', 'DELETE'), ['eb1', 'PUB']))).status, 204);
  assert.equal((await publish(ctx(req('https://x/start/sfu/publish/eb1/PUB', 'PATCH'), ['eb1', 'PUB']))).status, 204);
});

test('play pulls the publisher tracks with the viewer offer', async () => {
  const calls = stub({
    '/sessions/new': [201, { sessionId: 'VIEW' }],
    '/sessions/VIEW/tracks/new': [200, { requiresImmediateRenegotiation: false, tracks: [{ trackName: 'ta' }, { trackName: 'tv' }], sessionDescription: { type: 'answer', sdp: 'VANSWER' } }],
  });
  const r = await play(ctx(req('https://x/sfu/play/PUB/ta.tv'), ['PUB', 'ta.tv']));
  assert.equal(r.status, 201);
  assert.equal(await r.text(), 'VANSWER');
  assert.equal(r.headers.get('location'), '/sfu/play/PUB/ta.tv/VIEW');
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    tracks: [{ location: 'remote', sessionId: 'PUB', trackName: 'ta' }, { location: 'remote', sessionId: 'PUB', trackName: 'tv' }],
    sessionDescription: { type: 'offer', sdp: OFFER },
  });
});

test('play: malformed path is 400, ended session is 404', async () => {
  stub({});
  assert.equal((await play(ctx(req('https://x/sfu/play/PUB'), ['PUB']))).status, 400);
  stub({
    '/sessions/new': [201, { sessionId: 'VIEW' }],
    '/sessions/VIEW/tracks/new': [200, { tracks: [{ trackName: 'ta', errorCode: 'not_found', errorDescription: 'track not found' }], sessionDescription: { type: 'answer', sdp: 'X' } }],
  });
  const r = await play(ctx(req('https://x/sfu/play/PUB/ta'), ['PUB', 'ta']));
  assert.equal(r.status, 404);
  assert.match(await r.text(), /not live/i);
});

test('play refuses an unexpected renegotiation', async () => {
  stub({
    '/sessions/new': [201, { sessionId: 'VIEW' }],
    '/sessions/VIEW/tracks/new': [200, { requiresImmediateRenegotiation: true, tracks: [{ trackName: 'ta' }], sessionDescription: { type: 'offer', sdp: 'O' } }],
  });
  assert.equal((await play(ctx(req('https://x/sfu/play/PUB/ta'), ['PUB', 'ta']))).status, 502);
});

test('publish health check: 200 when the SFU answers, 502 when it does not', async () => {
  stub({ '/sessions/new': [201, { sessionId: 'H' }] });
  const ok = await publish(ctx(req('https://x/start/sfu/publish/health', 'GET'), ['health']));
  assert.equal(ok.status, 200);
  stub({ '/sessions/new': [401, { errorCode: 'unauthorized', errorDescription: 'Invalid bearer token' }] });
  const bad = await publish(ctx(req('https://x/start/sfu/publish/health', 'GET'), ['health']));
  assert.equal(bad.status, 502);
  assert.match(await bad.text(), /Invalid bearer token/);
});
