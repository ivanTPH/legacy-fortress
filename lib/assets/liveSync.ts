export type CanonicalAssetMutationDetail = {
  assetId: string;
  sectionKey: string;
  categoryKey: string;
  source: string;
};

const ASSET_MUTATION_EVENT = "lf-canonical-asset-mutated";

export function notifyCanonicalAssetMutation(detail: CanonicalAssetMutationDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CanonicalAssetMutationDetail>(ASSET_MUTATION_EVENT, { detail }));
}

export function subscribeToCanonicalAssetMutation(
  onMutation: (detail: CanonicalAssetMutationDetail) => void,
) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<CanonicalAssetMutationDetail>;
    if (!customEvent.detail) return;
    onMutation(customEvent.detail);
  };
  window.addEventListener(ASSET_MUTATION_EVENT, handler as EventListener);
  return () => window.removeEventListener(ASSET_MUTATION_EVENT, handler as EventListener);
}

export function shouldRefreshDashboardForAssetMutation(detail: CanonicalAssetMutationDetail) {
  return detail.sectionKey === "finances";
}
