import i18n from "../../i18n";
import type { FocusedUnavailableReason, GroupedViewUnavailableReason } from "./types";

// Resolved per call rather than at module load, so switching language updates
// the copy without a reload.
const t = (key: string, vars?: Record<string, string>) =>
  i18n.t(key as never, { ns: "graph", ...vars }) as string;

export function groupedViewReasonText(
  reason: GroupedViewUnavailableReason | null | undefined,
): string | null {
  if (!reason) {
    return null;
  }

  switch (reason.code) {
    case "communities-undetected":
      return t("viewCopy.groupedCommunitiesUndetected");
    case "community-nodes-missing":
      return t("viewCopy.groupedCommunityNodesMissing");
    case "invalid-community-layout":
      return t("viewCopy.groupedInvalidLayout", { nodeId: reason.nodeId });
    case "missing-grouped-node":
      return t("viewCopy.groupedMissingNode", { edgeId: reason.edgeId });
  }
}

export function focusedUnavailableReasonText(
  reason: FocusedUnavailableReason | null | undefined,
): string | null {
  if (!reason) {
    return null;
  }

  switch (reason.code) {
    case "no-selection":
      return t("viewCopy.focusedNoSelection");
    case "grouped-unresolvable":
      return t("viewCopy.focusedGroupedUnresolvable");
    case "not-in-graph":
      return t("viewCopy.focusedNotInGraph");
  }
}
