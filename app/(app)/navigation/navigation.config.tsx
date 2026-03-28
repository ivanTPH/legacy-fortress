import type { ReactNode } from "react";
import type { AppRouteNode } from "../../../config/routeManifest";
import { ACCOUNT_ROUTE_MANIFEST, APP_ROUTE_MANIFEST } from "../../../config/routeManifest";
import type { VaultCategoryGroupKey, VaultSubsectionKey } from "../../../lib/vaultPreferences";

export type NavNode = {
  id: string;
  label: string;
  path: string;
  description?: string;
  icon?: ReactNode;
  isEnabled?: boolean;
  rolesAllowed?: string[];
  vaultCategoryKey?: VaultCategoryGroupKey;
  vaultSubsectionKey?: VaultSubsectionKey;
  children?: NavNode[];
};

function mapRouteNode(node: AppRouteNode): NavNode {
  return {
    id: node.id,
    label: node.label,
    path: node.path,
    description: node.description,
    icon: node.icon,
    isEnabled: node.enabled !== false,
    vaultCategoryKey: node.vaultCategoryKey,
    vaultSubsectionKey: node.vaultSubsectionKey,
    children: node.children?.map(mapRouteNode),
  };
}

export const mainNavigation: NavNode[] = APP_ROUTE_MANIFEST.map(mapRouteNode);
export const accountNavigation: NavNode[] = ACCOUNT_ROUTE_MANIFEST.map(mapRouteNode);
export const navigationTree: NavNode[] = [...mainNavigation, ...accountNavigation];
