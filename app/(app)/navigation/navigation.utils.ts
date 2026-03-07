import { navigationTree, type NavNode } from "./navigation.config";

export function hasChildren(node: NavNode) {
  return Boolean(node.children && node.children.length > 0);
}

export function flattenNavigation(nodes: NavNode[] = navigationTree): NavNode[] {
  const out: NavNode[] = [];
  const walk = (items: NavNode[]) => {
    for (const item of items) {
      if (item.isEnabled === false) continue;
      out.push(item);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(nodes);
  return out;
}

export function getNavNodeByPath(path: string, nodes: NavNode[] = navigationTree): NavNode | null {
  const normalized = normalizePath(path);
  const all = flattenNavigation(nodes);
  return all.find((node) => normalizePath(node.path) === normalized) ?? null;
}

export function getParentChain(nodeId: string, nodes: NavNode[] = navigationTree): NavNode[] {
  const trail: NavNode[] = [];

  function search(items: NavNode[], parents: NavNode[]): boolean {
    for (const item of items) {
      if (item.isEnabled === false) continue;
      if (item.id === nodeId) {
        trail.push(...parents, item);
        return true;
      }
      if (item.children?.length && search(item.children, [...parents, item])) {
        return true;
      }
    }
    return false;
  }

  search(nodes, []);
  return trail;
}

export function getBreadcrumbsByPath(path: string, nodes: NavNode[] = navigationTree): NavNode[] {
  const node = getNavNodeByPath(path, nodes);
  if (!node) return [];
  return getParentChain(node.id, nodes);
}

export function getOpenMenuChain(path: string, nodes: NavNode[] = navigationTree): NavNode[] {
  return getBreadcrumbsByPath(path, nodes);
}

export function getNodeById(id: string, nodes: NavNode[] = navigationTree): NavNode | null {
  const all = flattenNavigation(nodes);
  return all.find((n) => n.id === id) ?? null;
}

export function normalizePath(path: string): string {
  if (!path) return "/";
  const clean = path.split("?")[0]?.split("#")[0] ?? "/";
  if (clean === "/") return "/";
  return clean.endsWith("/") ? clean.slice(0, -1) : clean;
}

export function getTopLevelByPath(path: string, nodes: NavNode[] = navigationTree): NavNode | null {
  const chain = getOpenMenuChain(path, nodes);
  return chain.length > 0 ? chain[0] : null;
}

export function getChildrenById(id: string | null, nodes: NavNode[] = navigationTree): NavNode[] {
  if (!id) return [];
  const node = getNodeById(id, nodes);
  return node?.children?.filter((child) => child.isEnabled !== false) ?? [];
}
