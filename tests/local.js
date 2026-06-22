// Local smoke test — exercises all endpoints with per-test timeout
const wallhaven = require('../api/wallhaven');
const wallpaperaccess = require('../api/wallpaperaccess');
const workshop = require('../api/workshop');
const dl = require('../api/dl');
const index = require('../api/index');

function makeRes(label) {
  let resolveOuter;
  const promise = new Promise(r => { resolveOuter = r; });
  let ended = false;
  const res = {
    statusCode: 200,
    setHeader(k, v) {},
    end(payload) {
      if (ended) return;
      ended = true;
      const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || '');
      const ct = res._ct || '';
      console.log(`[${label}] status=${res.statusCode} bytes=${buf.length}`);
      if (buf.length < 3000 && buf.length > 0) {
        console.log('  ', buf.toString().slice(0, 400));
      }
      resolveOuter();
    }
  };
  res._promise = promise;
  return res;
}

function withTimeout(p, ms, label) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

async function runOne(label, fn, url) {
  const res = makeRes(label);
  console.log(`-> ${label}: ${url}`);
  try {
    await withTimeout(fn({ url }, res), 25000, label);
    await res._promise;
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }
}

(async () => {
  await runOne('index', index, '/');
  await runOne('wallhaven-search', wallhaven, '/?q=anime&limit=3&purity=100');
  await runOne('wallhaven-dl', wallhaven, '/?id=j37zv5');
  await runOne('wallpaperaccess-dl', wallpaperaccess, '/?id=12578');
  await runOne('wallpaperaccess-bad', wallpaperaccess, '/');
  await runOne('workshop-browse', workshop, '/?sort=trend&limit=3');
  await runOne('dl-wallhaven', dl, '/?source=wallhaven&id=j37zv5');
  await runOne('dl-wallpaperaccess', dl, '/?source=wallpaperaccess&id=12578');
  await runOne('dl-workshop-redirect', dl, '/?source=workshop&id=3492627662');
  await runOne('dl-url-direct', dl, '/?url=' + encodeURIComponent('https://w.wallhaven.cc/full/j3/wallhaven-j37zv5.png'));
  await runOne('dl-bad', dl, '/');
  console.log('\n=== DONE ===');
})();
