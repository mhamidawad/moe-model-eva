import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const origin = process.argv[2] || 'http://127.0.0.1:8080';
const request = path => fetch(new URL(path, origin), {
  redirect: 'error', signal: AbortSignal.timeout(5000),
});

const health = await request('/healthz');
assert.equal(health.status, 200);
assert.equal(await health.text(), 'ok\n');

// Verify the exact committed application, including ESM imports and the logo.
for (const path of ['index.html', 'app.js', 'data.js', 'manage.js', 'workspace.js',
  'styles.css', 'favicon.svg', 'assets/moe-model-lab-logo.png', 'helpers/export-catalog.mjs']) {
  const response = await request(path === 'index.html' ? '/' : `/${path}`);
  assert.equal(response.status, 200, path);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(`out/${path}`), path);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
  assert.match(response.headers.get('cache-control'), /no-cache/, path);
  if (path.endsWith('.js')) assert.match(response.headers.get('content-type'), /(?:application|text)\/javascript/, path);
  if (path.endsWith('.css')) assert.match(response.headers.get('content-type'), /text\/css/, path);
  console.log(`PASS container serves committed ${path}`);
}

for (const path of ['/missing.js', '/package.json', '/tests/data.test.js', '/.git/config', '/.env', '/.openai/hosting.json']) {
  const response = await request(path);
  assert.ok([403, 404].includes(response.status), `${path} must not be served`);
}
console.log('PASS readiness, MIME types, cache policy, and non-runtime file isolation');
