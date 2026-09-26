import assert from 'node:assert/strict';
import { classifyCorePermissionDenial } from './fixtures/admin-core-domain-permission-journeys.mjs';
const origin = 'http://127.0.0.1:3000';
const checks = [];
for (const status of [301,302,303,307,308]) {
  const proof = classifyCorePermissionDenial(status, { location: '/admin/login?next=%2Fadmin%2Fcontent%2Ftopics' }, origin);
  assert.equal(proof.destination, '/admin/login'); assert.equal(proof.contract, 'existing-proxy-revoked-session-rejection');
  checks.push('Known login redirect HTTP ' + status);
}
assert.equal(classifyCorePermissionDenial(200, { 'x-action-redirect': origin + '/admin/login;replace' }, origin).destination, '/admin/login');
checks.push('Actual Next action redirect header targets only owned login');
for (const [status, headers, name] of [
  [200, {}, 'An acknowledged command without Auth evidence'],
  [200, { location: '/admin/login' }, 'An ordinary Location header on a successful response'],
  [401, {}, 'A status code without the measured login contract'],
  [500, { 'x-action-redirect': '/admin/login' }, 'An unrelated server failure'],
  [307, { location: 'https://example.invalid/admin/login' }, 'An external origin'],
  [307, { location: 'http://127.0.0.1:3001/admin/login' }, 'A different local service'],
  [307, { location: '/admin/login-extra' }, 'A neighboring pathname'],
  [307, { location: '/admin' }, 'An ordinary Admin navigation'],
  [307, { location: '/topics' }, 'A public route'],
]) { assert.equal(classifyCorePermissionDenial(status, headers, origin), null, name); checks.push('Reject ' + name); }
console.log(JSON.stringify({ status: 'pass', cases: checks.length, checks, scope: 'HTTP denial classifier only; real authenticated mounted controls, logout and native equality remain pending.' }, null, 2));
