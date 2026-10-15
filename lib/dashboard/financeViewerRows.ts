import { canViewPath, filterAssetIdsForViewer, filterRecordIdsForViewer, type ViewerAccessState } from "../access-control/viewerAccess.ts";
import type { DashboardAssetRow } from "./summary.ts";

export function filterFinanceDashboardRowsForViewer<T extends DashboardAssetRow>(rows: T[], viewer: ViewerAccessState): T[] {
  if (viewer.mode === "linked" && !canViewPath("/finances", viewer)) return [];
  return [
    ...filterAssetIdsForViewer(rows.filter((row) => row.metadata_json?.finance_record_source !== "records"), viewer),
    ...filterRecordIdsForViewer(rows.filter((row) => row.metadata_json?.finance_record_source === "records"), viewer),
  ];
}
