/**
 * Wave 11 verification: offline outbox logic (memory adapter — no browser needed).
 * Run: npm run test:offline
 */
import {
  createMemoryAdapter,
  createOutbox,
  syncOutbox,
  type QueuedMutation,
} from '../src/services/offlineQueue';

let passed = 0;
let failed = 0;
const results: string[] = [];

function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    passed += 1;
    results.push(`PASS ${name}`);
  } else {
    failed += 1;
    results.push(`FAIL ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function main() {
  // 1-2: enqueue + count
  const box = createOutbox(createMemoryAdapter());
  check('empty-outbox-count-zero', (await box.count()) === 0);
  const m1 = await box.enqueue({ endpoint: 'finance.php?action=add', method: 'POST', body: '{"a":1}' });
  check('enqueue-increases-count', (await box.count()) === 1);
  check('enqueue-assigns-id', typeof m1.id === 'string' && m1.id.length > 0);
  check('enqueue-defaults-attempts-zero', m1.attempts === 0);

  // 3: FIFO order
  await box.enqueue({ endpoint: 'b.php', method: 'POST' });
  await box.enqueue({ endpoint: 'c.php', method: 'PUT', body: '{}' });
  const order = (await box.list()).map(m => m.endpoint);
  check('fifo-order', JSON.stringify(order) === JSON.stringify(['finance.php?action=add', 'b.php', 'c.php']), order.join(','));

  // 4: body roundtrip
  check('body-preserved', (await box.list())[0].body === '{"a":1}');

  // 5: validation
  let threwEmpty = false;
  try { await box.enqueue({ endpoint: '  ', method: 'POST' }); } catch { threwEmpty = true; }
  check('rejects-empty-endpoint', threwEmpty);
  let threwGet = false;
  try { await box.enqueue({ endpoint: 'x.php', method: 'GET' }); } catch { threwGet = true; }
  check('rejects-get', threwGet);

  // 6: remove
  await box.remove(m1.id);
  check('remove-decreases-count', (await box.count()) === 2);
  check('remove-targets-id', !(await box.list()).some(m => m.id === m1.id));

  // 7: markAttempt
  const target = (await box.list())[0];
  await box.markAttempt(target.id);
  await box.markAttempt(target.id);
  check('mark-attempt-increments', (await box.list()).find(m => m.id === target.id)?.attempts === 2);

  // 8: subscribe fires
  let lastCount = -1;
  const unsub = box.subscribe(n => { lastCount = n; });
  await box.enqueue({ endpoint: 'd.php', method: 'DELETE' });
  check('subscribe-fires-on-enqueue', lastCount === 3, `got=${lastCount}`);
  unsub();
  await box.enqueue({ endpoint: 'e.php', method: 'POST' });
  check('unsubscribe-stops-events', lastCount === 3, `got=${lastCount}`);

  // 9: clear
  await box.clear();
  check('clear-empties', (await box.count()) === 0);

  // 10: syncOutbox happy path (FIFO send order)
  const box2 = createOutbox(createMemoryAdapter());
  await box2.enqueue({ endpoint: 'one.php', method: 'POST' });
  await box2.enqueue({ endpoint: 'two.php', method: 'POST' });
  const sentOrder: string[] = [];
  const r1 = await syncOutbox(box2, async m => { sentOrder.push(m.endpoint); return true; });
  check('sync-sends-all', r1.sent === 2 && r1.failed === 0 && r1.remaining === 0, JSON.stringify(r1));
  check('sync-fifo-send-order', sentOrder.join(',') === 'one.php,two.php');

  // 11: syncOutbox all-fail keeps items + bumps attempts
  const box3 = createOutbox(createMemoryAdapter());
  await box3.enqueue({ endpoint: 'f.php', method: 'POST' });
  const r2 = await syncOutbox(box3, async () => false);
  check('sync-failure-keeps-items', r2.sent === 0 && r2.failed === 1 && r2.remaining === 1, JSON.stringify(r2));
  check('sync-failure-bumps-attempts', (await box3.list())[0].attempts === 1);

  // 12: syncOutbox throwing sender treated as failure
  const r3 = await syncOutbox(box3, async () => { throw new Error('net-down'); });
  check('sync-throw-keeps-items', r3.failed === 1 && r3.remaining === 1);
  check('sync-throw-bumps-attempts', (await box3.list())[0].attempts === 2);

  // 13: partial failure
  const box4 = createOutbox(createMemoryAdapter());
  await box4.enqueue({ endpoint: 'ok.php', method: 'POST' });
  await box4.enqueue({ endpoint: 'bad.php', method: 'POST' });
  const r4 = await syncOutbox(box4, async m => m.endpoint !== 'bad.php');
  check('sync-partial', r4.sent === 1 && r4.failed === 1 && r4.remaining === 1, JSON.stringify(r4));
  check('sync-partial-keeps-failed-only', (await box4.list()).map(m => m.endpoint).join(',') === 'bad.php');

  // 14: persistence across outbox instances sharing one adapter
  const shared = createMemoryAdapter();
  const a = createOutbox(shared);
  const b = createOutbox(shared);
  await a.enqueue({ endpoint: 'shared.php', method: 'POST' });
  check('shared-adapter-visible', (await b.count()) === 1);

  // 15: sender receives full mutation shape
  let seen: QueuedMutation | null = null;
  await syncOutbox(b, async m => { seen = m; return true; });
  check('sender-gets-full-shape', !!seen && typeof (seen as QueuedMutation).createdAt === 'number');

  for (const r of results) console.log((r.startsWith('PASS') ? '✅' : '❌') + ' ' + r.slice(5));
  console.log(`\n${failed === 0 ? '🎉 ALL OFFLINE-QUEUE CHECKS PASSED' : '💥 FAILURES PRESENT'} (${passed} passed, ${failed} failed)`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('💥 SUITE CRASHED:', e); process.exit(1); });
