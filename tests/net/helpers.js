// Two-browser helpers. Each player is a separate browser context (a separate anonymous
// account) talking to the Firebase emulators through the real SDK and the real rules.
const PROJECT = 'demo-sky-siege';
export const NS = `${PROJECT}-default-rtdb`;
const EMU = {
  config: { apiKey: 'demo', authDomain: `${PROJECT}.firebaseapp.com`, projectId: PROJECT, appId: '1:1:web:1', databaseURL: `https://${NS}.firebaseio.com` },
  auth: 'http://127.0.0.1:9099', firestore: ['127.0.0.1', 8080], database: ['127.0.0.1', 9000],
};
const IGNORE = /fonts\.(googleapis|gstatic)\.com/;
// Also ignored below: Chrome's "unload is not allowed" notice. The database SDK prints it itself
// when it falls back to HTTP long polling (while a test cuts the WebSocket); it is not the game's.

// lag: added delay in ms per direction (100 = 200 ms round trip), on the realtime WebSocket.
// share: 'stub' records navigator.share calls, otherwise Web Share is unavailable.
export async function joinPlayer(browser, info, { locale = 'he-IL', viewport = { width: 844, height: 390 }, lag = 0, share = 'none', emu = {}, mobile = false, seed = null } = {}) {
  const ctx = await browser.newContext({ baseURL: info.project.use.baseURL, locale, viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.location().url || '') && !IGNORE.test(m.text()) && !/ERR_|WebSocket connection|WebSocket is already|unload is not allowed/.test(m.text())) errors.push('console.error: ' + m.text()); });
  const sockets = [];
  const bytes = { in: 0, out: 0 };   // realtime database traffic (WebSocket payloads)
  page.on('websocket', ws => {
    if (!ws.url().includes(':9000')) return;
    sockets.push(ws);
    ws.on('framereceived', f => { bytes.in += Buffer.byteLength(f.payload); });
    ws.on('framesent', f => { bytes.out += Buffer.byteLength(f.payload); });
  });
  await ctx.addInitScript(([e, s]) => {
    window.__skyEmulators = e;
    localStorage.setItem('skysiege_beta', '1');
    if (s === 'stub') { window.__shared = []; Object.defineProperty(navigator, 'share', { configurable: true, value: async d => { window.__shared.push(d); } }); }
    else Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  }, [{ ...EMU, ...emu }, share]);
  if (seed) await ctx.addInitScript(p => { if (!localStorage.getItem('skysiege_prog')) localStorage.setItem('skysiege_prog', JSON.stringify(p)); }, seed);

  const net = { blocked: false, open: [] };
  if (lag) {
    await page.routeWebSocket(/:9000\/\.ws/, ws => proxy(ws, lag, net));
    // when its WebSocket fails, the database SDK falls back to HTTP long polling: block that too
    await page.route(/:9000\//, r => (net.blocked ? r.abort() : r.continue()));
  }
  const player = {
    ctx, page, errors, sockets, net, bytes,
    async open(path = '/') { await page.goto(path); await page.waitForFunction(() => !!window.__sky); return player; },
    code: () => page.locator('#roomCode').textContent(),
    close: () => ctx.close(),
  };
  return player;
}

function proxy(ws, lag, net) {
  if (net.blocked) { ws.close(); return; }
  const server = ws.connectToServer();
  net.open.push(ws);
  const later = f => { if (lag) setTimeout(f, lag); else f(); };
  ws.onMessage(m => later(() => { try { server.send(m); } catch (e) {} }));
  server.onMessage(m => later(() => { try { ws.send(m); } catch (e) {} }));
  ws.onClose(() => { try { server.close(); } catch (e) {} });
  server.onClose(() => { try { ws.close(); } catch (e) {} });
}

// Cut one player's connection and keep it cut (the SDK will keep trying to reconnect).
export async function cutNetwork(player) {
  player.net.blocked = true;
  for (const ws of player.net.open) await ws.close().catch(() => {});
}

// Let the connection back in (the SDK reconnects on its own, with its usual back-off).
export function restoreNetwork(player) { player.net.blocked = false; player.net.open = []; }

export const createRoom = async p => {
  await p.page.click('#ttlFriend');
  await p.page.click('#roomCreate');
  await p.page.locator('#roomLobby').waitFor();
  return (await p.code());
};
export const joinByCode = async (p, code) => {
  await p.page.click('#ttlFriend');
  await p.page.fill('#roomCodeIn', code);
  await p.page.click('#roomJoin');
};

// Bypasses the rules, like the Firebase console.
export const seedRoom = (code, value) => fetch(`http://127.0.0.1:9000/rooms/${code}.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(value) });
export const readRoom = async code => (await fetch(`http://127.0.0.1:9000/rooms/${code}.json?ns=${NS}`, { headers: { Authorization: 'Bearer owner' } })).json();
