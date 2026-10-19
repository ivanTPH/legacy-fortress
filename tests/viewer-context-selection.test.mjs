import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_LINKED_GRANT_STORAGE_KEY,
  clearStoredLinkedGrantId,
  getStoredLinkedGrantId,
  isOwnVaultSelected,
  loadViewerAccessState,
  selectOwnVault,
  setStoredLinkedGrantId,
} from '../lib/access-control/viewerAccess.ts';

test('an explicit own-Vault choice survives hydration without selecting an unrelated linked grant', async () => {
  const originalWindow = globalThis.window;
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };

  try {
    const makeClient = (onboardingComplete) => ({
      from(table) {
        assert.ok(['account_access_grants', 'user_onboarding_state', 'terms_acceptances', 'identity_assurance_states', 'user_profiles', 'profiles'].includes(table));
        const result = table === 'user_onboarding_state'
          ? { data: { is_completed: onboardingComplete }, error: null }
          : table === 'terms_acceptances'
            ? { data: { user_id: 'signed-in-owner', terms_version: 'legacy-fortress-2026-03', accepted: true }, error: null }
            : { data: null, error: null };
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          limit: () => chain,
          maybeSingle: async () => result,
          order: async () => ({ data: [{ id: 'linked-grant', owner_user_id: 'other-owner', linked_user_id: 'signed-in-owner', assigned_role: 'friend_or_family', activation_status: 'verified', permissions_override: null }], error: null }),
        };
        return chain;
      },
    });

    setStoredLinkedGrantId('linked-grant');
    assert.equal(getStoredLinkedGrantId(), 'linked-grant');
    selectOwnVault('signed-in-owner');
    assert.equal(getStoredLinkedGrantId(), '');
    assert.equal(isOwnVaultSelected('signed-in-owner'), true);
    assert.equal(isOwnVaultSelected('different-account'), false);

    const viewer = await loadViewerAccessState(makeClient(true), 'signed-in-owner', {
      preferredGrantId: getStoredLinkedGrantId(),
      preferOwnVault: isOwnVaultSelected('signed-in-owner'),
    });
    assert.equal(viewer.mode, 'owner');
    assert.equal(viewer.targetOwnerUserId, 'signed-in-owner');
    assert.equal(viewer.grantId, null);

    const linkedOnlyViewer = await loadViewerAccessState(makeClient(false), 'signed-in-owner', {
      preferOwnVault: true,
    });
    assert.equal(linkedOnlyViewer.mode, 'linked');
    assert.equal(linkedOnlyViewer.grantId, 'linked-grant');

    setStoredLinkedGrantId('linked-grant');
    assert.equal(isOwnVaultSelected('signed-in-owner'), false);
    assert.equal(getStoredLinkedGrantId(), 'linked-grant');
    clearStoredLinkedGrantId();
    assert.equal(values.has(ACTIVE_LINKED_GRANT_STORAGE_KEY), false);
  } finally {
    globalThis.window = originalWindow;
  }
});
