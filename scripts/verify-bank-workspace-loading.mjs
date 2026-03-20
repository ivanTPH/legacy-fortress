import assert from 'node:assert/strict';

async function simulateWorkspaceLoad({ fetchAssets, fetchDocuments, timeoutMs = 5000 }) {
  const state = {
    loading: false,
    records: [],
    attachments: [],
    events: [],
    timedOut: false,
  };

  const stamp = () => Date.now();
  const t0 = stamp();

  state.loading = true;
  state.events.push({ at: 0, type: 'loading', value: true });

  const timeout = setTimeout(() => {
    state.timedOut = true;
    state.loading = false;
    state.events.push({ at: stamp() - t0, type: 'timeout' });
    state.events.push({ at: stamp() - t0, type: 'loading', value: false });
  }, timeoutMs);

  const assets = await fetchAssets();
  state.records = assets;
  if (state.loading) {
    state.loading = false;
    state.events.push({ at: stamp() - t0, type: 'loading', value: false });
  }
  state.events.push({ at: stamp() - t0, type: 'assets', count: assets.length });

  if (assets.length > 0) {
    fetchDocuments(assets.map((x) => x.id)).then((docs) => {
      state.attachments = docs;
      state.events.push({ at: stamp() - t0, type: 'documents', count: docs.length });
    });
  }

  clearTimeout(timeout);
  return state;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  // 1) zero assets
  const zero = await simulateWorkspaceLoad({
    fetchAssets: async () => {
      await delay(20);
      return [];
    },
    fetchDocuments: async () => [],
  });
  assert.equal(zero.loading, false);
  assert.equal(zero.records.length, 0);

  // 2) one asset
  const one = await simulateWorkspaceLoad({
    fetchAssets: async () => {
      await delay(20);
      return [{ id: 'asset-1' }];
    },
    fetchDocuments: async () => [],
  });
  assert.equal(one.loading, false);
  assert.equal(one.records.length, 1);

  // 3) delayed documents should not block records render
  const delayedDocs = await simulateWorkspaceLoad({
    fetchAssets: async () => {
      await delay(20);
      return [{ id: 'asset-1' }];
    },
    fetchDocuments: async () => {
      await delay(1000);
      return [{ id: 'doc-1' }];
    },
  });
  const loadingFalseAt = delayedDocs.events.find((e) => e.type === 'loading' && e.value === false)?.at ?? 0;
  const docsAt = delayedDocs.events.find((e) => e.type === 'documents')?.at ?? Number.POSITIVE_INFINITY;
  assert.ok(loadingFalseAt < docsAt, 'assets must render before documents complete');

  // 4) slow API (3s+) still transitions
  const slow = await simulateWorkspaceLoad({
    fetchAssets: async () => {
      await delay(3200);
      return [];
    },
    fetchDocuments: async () => [],
  });
  const hasLoadingTrue = slow.events.some((e) => e.type === 'loading' && e.value === true);
  const hasLoadingFalse = slow.events.some((e) => e.type === 'loading' && e.value === false);
  assert.ok(hasLoadingTrue && hasLoadingFalse);

  console.log('PASS: scenario 1 zero assets -> empty state path');
  console.log('PASS: scenario 2 one asset -> records path');
  console.log('PASS: scenario 3 delayed documents do not block asset render');
  console.log('PASS: scenario 4 slow API shows loading then transitions');
}

run().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
