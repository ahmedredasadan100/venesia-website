import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { normalizeVerificationText } from '../lib/verification-text.mjs';

/** Existing infrastructure owner calls this; no product fixture is rewritten. */
export async function verifyVerificationTextContract(root) {
  const read = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
  const lf = value => normalizeVerificationText(value);
  const crlf = value => lf(value).replaceAll('\n', '\r\n');
  const controls = [];
  const adopters = JSON.parse(read('scripts/fixtures/verification-text-adopters.json'));
  assert.equal(new Set(adopters).size, adopters.length);
  for (const file of adopters) {
    const source = read(file);
    assert.match(source, /import \{ normalizeVerificationText \} from "\.\/lib\/verification-text\.mjs"/u);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    let uses = 0;
    function walk(node) {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === 'normalizeVerificationText') uses++;
      ts.forEachChild(node, walk);
    }
    walk(ast); assert.ok(uses > 0, file + ' must actually adopt the owner');
    // Complete logical source stays exact, including comments, ordering and whitespace.
    const expected = lf(source);
    for (const input of [expected, crlf(expected)]) {
      assert.equal(normalizeVerificationText(input), expected, file);
      const required = 'normalizeVerificationText';
      assert.throws(() => assert.equal(normalizeVerificationText(input.replace(required, 'wrongVerificationOwner')), expected));
      assert.throws(() => assert.equal(normalizeVerificationText(input.replace(required, '')), expected));
      const lines = input.split(/\r?\n/u);
      assert.throws(() => assert.equal(normalizeVerificationText(lines.slice(1).concat(lines[0]).join('\n')), expected));
    }
    controls.push({ owner: file, lf: 'PASS', crlf: 'PASS', logicalMutation: 'REJECTED', missing: 'REJECTED', ordering: 'REJECTED', proof: 'complete source equivalence; actual owner executes in full verification' });
  }
  const vectors = ['a\nb\n', 'a\r\nb\r\n', 'a\rb', '\uFEFF x\t \r\n\r\n', 'سطر\r\nنص  '];
  for (const value of vectors) {
    assert.equal(normalizeVerificationText(value), value.replace(/\r\n/g, '\n'));
    assert.equal(normalizeVerificationText(value, { loneCR: true }), value.replace(/\r\n?/g, '\n'));
    assert.equal(normalizeVerificationText(normalizeVerificationText(value)), normalizeVerificationText(value));
  }
  assert.equal(normalizeVerificationText('a\rb'), 'a\rb', 'Standalone CR is preserved by default');
  assert.notEqual(normalizeVerificationText(' x\n'), normalizeVerificationText('x\n'));
  assert.notEqual(normalizeVerificationText('x\n\n'), normalizeVerificationText('x\n'));
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.notEqual(hash('a\nb'), hash('a\r\nb'), 'Raw byte evidence remains distinct');

  // Execute the exact source-owned guard statements, not copies of their predicates.
  for (const spec of [
    { owner: 'scripts/verify-media-center-product-review.mts', variable: 'editor', file: 'src/components/admin/page-blocks/MediaHubModuleEditClient.tsx', forbidden: '<textarea\n                              name="presentation_description"', required: 'name="presentation_description"' },
    { owner: 'scripts/verify-public-content-search.mts', variable: 'mediaTypes', file: 'src/lib/media-center/types.ts', forbidden: '= [\n  "news"', required: 'CONTENT_TYPES.filter' },
  ]) {
    const source = read(spec.owner), tree = ts.createSourceFile(spec.owner, source, ts.ScriptTarget.Latest, true);
    const statement = needle => tree.statements.filter(node => ts.isExpressionStatement(node) && node.getText(tree).includes(JSON.stringify(needle)) || ts.isExpressionStatement(node) && node.getText(tree).includes("'" + needle.replaceAll('\n', '\\n') + "'"));
    const guards = [spec.required, spec.forbidden].map(needle => { const found = statement(needle); assert.equal(found.length, 1, spec.owner + ': actual guard must be unique'); return found[0].getText(tree); });
    const guard = new Function('assert', spec.variable, guards.join('\n'));
    const value = lf(read(spec.file));
    for (const input of [value, crlf(value)]) {
      guard(assert, normalizeVerificationText(input));
      assert.throws(() => guard(assert, normalizeVerificationText(input.replaceAll(spec.required, 'wrong-required-content'))));
      assert.throws(() => guard(assert, normalizeVerificationText(input.replaceAll(spec.required, ''))));
      const forbidden = input.includes('\r\n') ? crlf(spec.forbidden) : spec.forbidden;
      assert.throws(() => guard(assert, normalizeVerificationText(input + forbidden)));
    }
    controls.push({owner: spec.owner, actualGuard: 'LF/CRLF PASS; missing and logical regression rejected', ordering: 'not applicable to presence/absence predicates'});
  }
  const ownerPath = 'scripts/verify-admin-core-query-fixture-contract.mjs';
  const owner = read(ownerPath), tree = ts.createSourceFile(ownerPath, owner, ts.ScriptTarget.Latest, true);
  const declaration = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'verifyCoreQueryFixtureScheduling');
  assert.ok(declaration);
  const run = new Function('assert', 'ts', 'normalizeVerificationText', declaration.getText(tree).replace(/^export /u, '') + ';return verifyCoreQueryFixtureScheduling;')(assert, ts, normalizeVerificationText);
  const { loadCoreQueryPresentationPlan } = await import('./admin-core-query-presentation-plan.mjs');
  const plan = await loadCoreQueryPresentationPlan();
  const fixture = lf(read('scripts/fixtures/admin-core-query-presentation-fixtures.mts'));
  for (const input of [fixture, crlf(fixture)]) {
    const passed = await run(input, plan); assert.ok(passed.length > 10);
    const normalized = lf(input);
    for (const [kind, mutant] of [
      ['logical', normalized.replace('chunk+=chunkSize', 'chunk+=chunkSize+1')],
      ['missing', normalized.replace('  await handle.renewDatabaseControlConnection();\n  }', '  }')],
      ['ordering', normalized.replace("await db.query('commit');", "await handle.renewDatabaseControlConnection();await db.query('commit');")],
    ]) {
      assert.notEqual(mutant, normalized, kind + ' must mutate the real fixture');
      await assert.rejects(run(input.includes('\r\n') ? crlf(mutant) : mutant, plan));
    }
  }
  controls.push({owner:ownerPath, actualScheduling:'LF/CRLF PASS; logical mutation, missing renewal and wrong transaction ordering rejected'});
  assert.ok(root);
  console.log('PASS Verification text contract: ' + JSON.stringify(controls));
  return controls;
}
