export function getTopMenuKeyAction({ key, hasChildren }) {
  if (key === "ArrowDown") return "focus-next";
  if (key === "ArrowUp") return "focus-prev";
  if (key === "ArrowRight" && hasChildren) return "open-primary";
  if (key === "Escape") return "close-all";
  if (key === "Enter" || key === " ") return hasChildren ? "open-primary" : "navigate";
  return "none";
}

export function getFlyoutMenuKeyAction({ key, hasChildren, level }) {
  if (key === "Escape") return level === 3 ? "close-secondary" : "close-all";
  if (key === "ArrowRight" && hasChildren && level === 2) return "open-secondary";
  if ((key === "Enter" || key === " ") && hasChildren && level === 2) return "open-secondary";
  if (key === "Enter" || key === " ") return "navigate";
  return "none";
}

