export type FlyoutTopInput = {
  anchorTop: number;
  anchorHeight: number;
  containerTop: number;
  viewportHeight: number;
  itemCount: number;
  itemHeight?: number;
  panelPadding?: number;
  minTop?: number;
  viewportPadding?: number;
};

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function estimateFlyoutPanelHeight(itemCount: number, itemHeight = 42, panelPadding = 16) {
  const safeCount = Math.max(1, itemCount);
  return safeCount * itemHeight + panelPadding;
}

export function computeFlyoutTop(input: FlyoutTopInput) {
  const {
    anchorTop,
    anchorHeight,
    containerTop,
    viewportHeight,
    itemCount,
    itemHeight = 42,
    panelPadding = 16,
    minTop = 10,
    viewportPadding = 12,
  } = input;

  const estimatedHeight = estimateFlyoutPanelHeight(itemCount, itemHeight, panelPadding);
  const parentCenter = anchorTop - containerTop + anchorHeight / 2;
  const centeredTop = parentCenter - estimatedHeight / 2;
  const maxTop = viewportHeight - containerTop - estimatedHeight - viewportPadding;

  return Math.round(clamp(centeredTop, minTop, maxTop));
}
