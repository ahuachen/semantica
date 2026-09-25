import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import i18n from "../../../i18n";
import { buildGraphColorLegend } from "../graphColorLegend";
import type {
  GraphAnalyticsSnapshot,
  GraphDiagnosticsSnapshot,
  GraphEffectAvailability,
  GraphEffectToggle,
} from "../types";
import type { GraphPlugin } from "./types";

const EFFECTS_PANEL_ID = "effects-panel";

type EffectRowConfig = {
  key: GraphEffectToggle;
  label: string;
  description: string;
};

// Built fresh (not module-level) so labels/descriptions reflect the active
// language on every panel render.
function buildSceneEffectRows(): EffectRowConfig[] {
  return [
    {
      key: "pathPulseEnabled",
      label: i18n.t("graph:effects.sceneRows.pathPulse.label", { defaultValue: "Path Pulse" }),
      description: i18n.t("graph:effects.sceneRows.pathPulse.description", {
        defaultValue: "Animated pulse on the active selected path.",
      }),
    },
    {
      key: "pathFlowEnabled",
      label: i18n.t("graph:effects.sceneRows.pathFlow.label", { defaultValue: "Path Flow" }),
      description: i18n.t("graph:effects.sceneRows.pathFlow.description", {
        defaultValue: "Directional flow accents along the active selected path.",
      }),
    },
    {
      key: "lensEnabled",
      label: i18n.t("graph:effects.sceneRows.lens.label", { defaultValue: "Neighborhood Lens" }),
      description: i18n.t("graph:effects.sceneRows.lens.description", {
        defaultValue: "Local emphasis around the hovered or selected node.",
      }),
    },
    {
      key: "temporalEmphasisEnabled",
      label: i18n.t("graph:effects.sceneRows.temporalEmphasis.label", { defaultValue: "Temporal Emphasis" }),
      description: i18n.t("graph:effects.sceneRows.temporalEmphasis.description", {
        defaultValue: "Subtle glow around temporally relevant nodes in the active time window.",
      }),
    },
    {
      key: "semanticRegionsEnabled",
      label: i18n.t("graph:effects.sceneRows.semanticRegions.label", { defaultValue: "Semantic Regions" }),
      description: i18n.t("graph:effects.sceneRows.semanticRegions.description", {
        defaultValue: "Quiet semantic hulls around the strongest visible topic clusters.",
      }),
    },
    {
      key: "contoursEnabled",
      label: i18n.t("graph:effects.sceneRows.contours.label", { defaultValue: "Contours" }),
      description: i18n.t("graph:effects.sceneRows.contours.description", {
        defaultValue: "Low-contrast density halos around the strongest visible anchors.",
      }),
    },
    {
      key: "edgeLabelsEnabled",
      label: i18n.t("graph:effects.sceneRows.edgeLabels.label", { defaultValue: "Edge Labels" }),
      description: i18n.t("graph:effects.sceneRows.edgeLabels.description", {
        defaultValue: "Draw the relationship type on graph edges. Off restores label-free edges on dense graphs.",
      }),
    },
    {
      key: "legendEnabled",
      label: i18n.t("graph:effects.sceneRows.regionsSummary.label", { defaultValue: "Regions Summary" }),
      description: i18n.t("graph:effects.sceneRows.regionsSummary.description", {
        defaultValue: "Keep the regions and signals summary visible in the Effects panel.",
      }),
    },
  ];
}

function buildIntelligenceEffectRows(): EffectRowConfig[] {
  return [
    {
      key: "pathfindingEnabled",
      label: i18n.t("graph:effects.intelligenceRows.pathfinding.label", { defaultValue: "Directed Pathfinding" }),
      description: i18n.t("graph:effects.intelligenceRows.pathfinding.description", {
        defaultValue: "Compare the traced path against a strict local directed shortest path.",
      }),
    },
    {
      key: "communitiesEnabled",
      label: i18n.t("graph:effects.intelligenceRows.communities.label", { defaultValue: "Community Regions" }),
      description: i18n.t("graph:effects.intelligenceRows.communities.description", {
        defaultValue: "Detect stable Louvain communities for orientation and scene grouping.",
      }),
    },
    {
      key: "centralityEnabled",
      label: i18n.t("graph:effects.intelligenceRows.centrality.label", { defaultValue: "Centrality Ranking" }),
      description: i18n.t("graph:effects.intelligenceRows.centrality.description", {
        defaultValue: "Rank the strongest graph anchors for labels, regions, and navigation.",
      }),
    },
  ];
}

const AVAILABILITY_KEYS: Record<GraphEffectToggle, keyof GraphDiagnosticsSnapshot["effectAvailability"]> = {
  pathPulseEnabled: "pathPulse",
  pathFlowEnabled: "pathFlow",
  lensEnabled: "lens",
  temporalEmphasisEnabled: "temporalEmphasis",
  semanticRegionsEnabled: "semanticRegions",
  contoursEnabled: "contours",
  pathfindingEnabled: "pathfinding",
  communitiesEnabled: "communities",
  centralityEnabled: "centrality",
  legendEnabled: "legend",
  edgeLabelsEnabled: "edgeLabels",
  diagnosticsEnabled: "diagnostics",
};

function renderAvailabilityText(availability: GraphEffectAvailability) {
  if (availability.available) {
    if (typeof availability.visibleSegments === "number" && typeof availability.segmentCap === "number") {
      const segmentsLabel = i18n.t("graph:effects.segmentsSuffix", {
        visible: availability.visibleSegments,
        cap: availability.segmentCap,
        defaultValue: "{{visible}}/{{cap}} segments",
      });
      return `${availability.reason} - ${segmentsLabel}`;
    }
    return availability.reason;
  }

  return availability.detail ? `${availability.reason} - ${availability.detail}` : availability.reason;
}

function collectFallbackLegendItems(context: Parameters<NonNullable<GraphPlugin["renderPanel"]>>[0]) {
  return buildGraphColorLegend(context.graph, context.theme)
    .sort((left, right) => right.count - left.count)
    .slice(0, context.theme.effects.legend.maxGroups);
}

function resolveAvailability(
  availabilityMap: GraphDiagnosticsSnapshot["effectAvailability"] | undefined,
  key: GraphEffectToggle,
  enabled: boolean,
): GraphEffectAvailability {
  return availabilityMap?.[AVAILABILITY_KEYS[key]] ?? {
    enabled,
    available: false,
    reason: i18n.t("graph:effects.waitingForRuntime", { defaultValue: "Waiting for graph runtime" }),
  };
}

function EffectToggleRow({
  label,
  description,
  checked,
  availability,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  availability: GraphEffectAvailability;
  onToggle: () => void;
}) {
  const { t } = useTranslation("graph");
  return (
    <div style={toggleRowStyle}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={rowTitleStyle}>{label}</div>
        <div style={rowDescriptionStyle}>{description}</div>
        <div style={rowMetaStyle}>{renderAvailabilityText(availability)}</div>
      </div>
      <button type="button" onClick={onToggle} style={checked ? toggleButtonActiveStyle : toggleButtonStyle}>
        {checked ? t("effects.onLabel", "On") : t("effects.offLabel", "Off")}
      </button>
    </div>
  );
}

function renderRegionsAndSignals(
  context: Parameters<NonNullable<GraphPlugin["renderPanel"]>>[0],
  analytics: GraphAnalyticsSnapshot | null,
) {
  const fallbackLegendItems = collectFallbackLegendItems(context);
  const semanticRegions = analytics?.semanticRegions.summaries ?? [];
  const communities = analytics?.communities.summaries ?? [];
  const centrality = analytics?.centrality.topNodes ?? [];
  const directedPath = analytics?.directedPath ?? null;

  if (!semanticRegions.length && !communities.length && !centrality.length && !fallbackLegendItems.length && !directedPath) {
    return (
      <div style={emptyTextStyle}>
        {i18n.t("graph:effects.regionsSignalsEmptyState", {
          defaultValue: "Regions and intelligence summaries will populate when graph analytics are ready.",
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {semanticRegions.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={subsectionTitleStyle}>
            {i18n.t("graph:effects.semanticRegionsSubsection", { defaultValue: "Semantic regions" })}
          </div>
          {semanticRegions.map((region) => (
            <div key={region.semanticGroup} style={legendRowStyle}>
              <span
                style={{
                  ...legendSwatchStyle,
                  background: region.color,
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 14px ${region.color}40`,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={rowTitleStyle}>{region.semanticGroup}</div>
                <div style={rowMetaStyle}>
                  {i18n.t("graph:effects.visibleOfTotal", {
                    visible: region.visibleNodeCount.toLocaleString(),
                    total: region.nodeCount.toLocaleString(),
                    defaultValue: "{{visible}} visible / {{total}} total",
                  })}
                </div>
              </div>
              <div style={signalBadgeStyle}>{region.anchorLabel}</div>
            </div>
          ))}
        </div>
      ) : null}

      {communities.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={subsectionTitleStyle}>
            {i18n.t("graph:effects.communityAnchorsSubsection", { defaultValue: "Community anchors" })}
          </div>
          {communities.slice(0, 3).map((community) => (
            <div key={community.communityId} style={signalRowStyle}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={rowTitleStyle}>{community.anchorLabel}</div>
                <div style={rowMetaStyle}>
                  {i18n.t("graph:effects.communitySummary", {
                    communityId: community.communityId,
                    visible: community.visibleNodeCount,
                    total: community.nodeCount,
                    defaultValue: "Community {{communityId}} - {{visible}} visible / {{total}} total",
                  })}
                </div>
              </div>
              <div style={signalBadgeStyle}>{community.dominantSemanticGroup}</div>
            </div>
          ))}
        </div>
      ) : null}

      {centrality.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={subsectionTitleStyle}>
            {i18n.t("graph:effects.centralityLeadersSubsection", { defaultValue: "Centrality leaders" })}
          </div>
          {centrality.slice(0, 3).map((node) => (
            <div key={node.id} style={signalRowStyle}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={rowTitleStyle}>{node.label}</div>
                <div style={rowMetaStyle}>
                  {i18n.t("graph:effects.centralityScoreSummary", {
                    semanticGroup: node.semanticGroup,
                    score: node.score.toFixed(3),
                    defaultValue: "{{semanticGroup}} - score {{score}}",
                  })}
                </div>
              </div>
              <div style={signalBadgeStyle}>
                {i18n.t("graph:effects.degreeBadge", { value: node.degree.toFixed(3), defaultValue: "deg {{value}}" })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {directedPath ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={subsectionTitleStyle}>
            {i18n.t("graph:effects.directedPathfindingSubsection", { defaultValue: "Directed pathfinding" })}
          </div>
          <div style={signalRowStyle}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={rowTitleStyle}>
                {directedPath.ready
                  ? i18n.t("graph:effects.localDirectedPathReady", { defaultValue: "Local directed path ready" })
                  : i18n.t("graph:effects.waitingForPathContext", { defaultValue: "Waiting for path context" })}
              </div>
              <div style={rowMetaStyle}>{directedPath.reason}</div>
            </div>
            {directedPath.ready ? (
              <div style={signalBadgeStyle}>
                {i18n.t("graph:effects.directedPathHops", {
                  count: directedPath.length,
                  matchSuffix: directedPath.verifiedAgainstActivePath
                    ? i18n.t("graph:effects.directedPathMatchSuffix", { defaultValue: " - match" })
                    : "",
                  defaultValue: "{{count}} hops{{matchSuffix}}",
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!semanticRegions.length && !communities.length && !centrality.length && fallbackLegendItems.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={subsectionTitleStyle}>
            {i18n.t("graph:effects.fallbackLegendSubsection", { defaultValue: "Fallback semantic legend" })}
          </div>
          {fallbackLegendItems.map((item) => (
            <div key={item.id} style={legendRowStyle}>
              <span
                style={{
                  ...legendSwatchStyle,
                  background: item.color,
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 14px ${item.color}40`,
                }}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={rowTitleStyle}>{item.group}</div>
                <div style={rowMetaStyle}>
                  {i18n.t("graph:legend.nodeCount", { count: item.count.toLocaleString(), defaultValue: "{{count}} nodes" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const explorationEffectsPluginPhaseC: GraphPlugin = {
  id: "exploration-effects",
  mount: () => {},
  unmount: () => {},
  onStateChange: () => {},
  toolbarItems: (context) => [
    {
      id: "effects-toggle",
      label: i18n.t("graph:effects.toggleLabel", { defaultValue: "Effects" }),
      title: i18n.t("graph:effects.toggleTitle", { defaultValue: "Open exploration effects controls" }),
      active: context.isPanelOpen(EFFECTS_PANEL_ID),
      order: 18,
      onClick: () => context.dispatchAction({ type: "togglePanel", panelId: EFFECTS_PANEL_ID }),
    },
  ],
  renderPanel: (context) => {
    if (!context.isPanelOpen(EFFECTS_PANEL_ID)) {
      return null;
    }

    const effectsState = context.getEffectsState();
    const diagnosticsSnapshot = context.getDiagnosticsSnapshot();
    const analyticsSnapshot = context.getAnalyticsSnapshot();
    const availability = diagnosticsSnapshot?.effectAvailability;
    const showSignalsSection =
      effectsState.legendEnabled
      || effectsState.semanticRegionsEnabled
      || effectsState.communitiesEnabled
      || effectsState.centralityEnabled
      || effectsState.pathfindingEnabled;

    const sceneEffectRows = buildSceneEffectRows();
    const intelligenceEffectRows = buildIntelligenceEffectRows();

    return {
      id: EFFECTS_PANEL_ID,
      title: i18n.t("graph:effects.toggleLabel", { defaultValue: "Effects" }),
      placement: "bottom",
      order: 8,
      defaultOpen: false,
      preferredWidth: 460,
      preferredHeight: 360,
      content: (
        <div style={panelBodyStyle}>
          <div style={panelEyebrowStyle}>
            {i18n.t("graph:effects.eyebrow", { defaultValue: "Exploration effects" })}
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              {i18n.t("graph:effects.sceneEffectsSection", { defaultValue: "Scene effects" })}
            </div>
            {sceneEffectRows.map((row) => (
              <EffectToggleRow
                key={row.key}
                label={row.label}
                description={row.description}
                checked={effectsState[row.key]}
                availability={resolveAvailability(availability, row.key, effectsState[row.key])}
                onToggle={() => context.dispatchAction({ type: "toggleEffect", effect: row.key })}
              />
            ))}
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              {i18n.t("graph:effects.graphIntelligenceSection", { defaultValue: "Graph intelligence" })}
            </div>
            {intelligenceEffectRows.map((row) => (
              <EffectToggleRow
                key={row.key}
                label={row.label}
                description={row.description}
                checked={effectsState[row.key]}
                availability={resolveAvailability(availability, row.key, effectsState[row.key])}
                onToggle={() => context.dispatchAction({ type: "toggleEffect", effect: row.key })}
              />
            ))}
          </div>

          {showSignalsSection ? (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>
                {i18n.t("graph:effects.regionsAndSignalsSection", { defaultValue: "Regions and signals" })}
              </div>
              {renderRegionsAndSignals(context, analyticsSnapshot)}
            </div>
          ) : null}

          {import.meta.env.DEV ? (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>
                {i18n.t("graph:effects.diagnosticsSection", { defaultValue: "Diagnostics" })}
              </div>
              <EffectToggleRow
                label={i18n.t("graph:effects.devDiagnosticsLabel", { defaultValue: "Dev Diagnostics" })}
                description={i18n.t("graph:effects.devDiagnosticsDescription", {
                  defaultValue: "Inspect plugin, interaction, and effect gating state.",
                })}
                checked={effectsState.diagnosticsEnabled}
                availability={resolveAvailability(availability, "diagnosticsEnabled", effectsState.diagnosticsEnabled)}
                onToggle={() => context.dispatchAction({ type: "toggleEffect", effect: "diagnosticsEnabled" })}
              />
              {effectsState.diagnosticsEnabled && diagnosticsSnapshot ? (
                <details style={detailsStyle}>
                  <summary style={summaryStyle}>
                    {i18n.t("graph:effects.runtimeSnapshot", { defaultValue: "Runtime snapshot" })}
                  </summary>
                  <pre style={diagnosticsPreStyle}>
                    {JSON.stringify({ diagnostics: diagnosticsSnapshot, analytics: analyticsSnapshot }, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    };
  },
};

const panelBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const panelEyebrowStyle: CSSProperties = {
  color: "#8ea4be",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};

const sectionTitleStyle: CSSProperties = {
  color: "#dce9f8",
  fontSize: 12,
  fontWeight: 700,
};

const subsectionTitleStyle: CSSProperties = {
  color: "#9cc4ec",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const toggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 0",
};

const rowTitleStyle: CSSProperties = {
  color: "#f3f7fd",
  fontSize: 13,
  fontWeight: 600,
};

const rowDescriptionStyle: CSSProperties = {
  color: "#a1b7cf",
  fontSize: 12,
  lineHeight: 1.45,
};

const rowMetaStyle: CSSProperties = {
  color: "#7fc6ff",
  fontSize: 11,
  lineHeight: 1.45,
};

const toggleButtonStyle: CSSProperties = {
  minWidth: 52,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "#cfe0f4",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const toggleButtonActiveStyle: CSSProperties = {
  ...toggleButtonStyle,
  background: "rgba(31, 111, 235, 0.24)",
  border: "1px solid rgba(127, 208, 255, 0.28)",
  color: "#eef6ff",
};

const legendRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};

const legendSwatchStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  flexShrink: 0,
};

const signalRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.02)",
};

const signalBadgeStyle: CSSProperties = {
  padding: "5px 8px",
  borderRadius: 999,
  background: "rgba(31, 111, 235, 0.16)",
  border: "1px solid rgba(127, 208, 255, 0.16)",
  color: "#dce9f8",
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const detailsStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(0,0,0,0.14)",
  overflow: "hidden",
};

const summaryStyle: CSSProperties = {
  cursor: "pointer",
  padding: "10px 12px",
  color: "#c6d4e3",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const diagnosticsPreStyle: CSSProperties = {
  margin: 0,
  padding: "0 12px 12px",
  color: "#dce9f8",
  fontSize: 11,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const emptyTextStyle: CSSProperties = {
  color: "#8ea4be",
  fontSize: 12,
  lineHeight: 1.5,
};
