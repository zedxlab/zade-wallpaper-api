// Shared HTTP helper. Uses undici (already a dep).
const { fetch } = require('undici');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_HEADERS = {
  'User-Agent': UA
};

async function getHTML(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      ...BASE_HEADERS,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      ...extraHeaders
    },
    redirect: 'follow'
  });
  const status = res.status;
  const html = await res.text();
  return { status, html, finalUrl: res.url || url };
}

async function getBuffer(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      ...BASE_HEADERS,
      'Accept': '*/*',
      ...extraHeaders
    },
    redirect: 'follow'
  });
  const status = res.status;
  const contentType = res.headers.get('content-type') || '';
  const contentLength = res.headers.get('content-length');
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const buf = Buffer.concat(chunks);
  return { status, contentType, contentLength, buffer: buf };
}

module.exports = { getHTML, getBuffer };
