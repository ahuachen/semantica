"""
Semantica Explorer demo graph builder.

Builds a small, deterministic credit-risk ContextGraph so the Knowledge
Explorer has something meaningful to render: entities, an ontology-ish type
mix, three linked decisions with a causal chain, and temporal validity
windows.

Usage:
    python demo/build_demo_graph.py [output.json]
"""

from __future__ import annotations

import sys
from pathlib import Path

from semantica.context.context_graph import ContextGraph

# One colour per node type, so the Explorer legend is readable at a glance.
COLORS = {
    "Person": "#63E6FF",
    "Organization": "#A78BFA",
    "Location": "#34D399",
    "Product": "#FBBF24",
    "Policy": "#F472B6",
    "Document": "#94A3B8",
}

NODES = [
    ("alice_chen", "Person", "Alice Chen", "Relationship manager, Corporate Banking"),
    ("raj_patel", "Person", "Raj Patel", "Credit risk analyst"),
    ("meridian_capital", "Organization", "Meridian Capital", "Applicant, mid-market lender"),
    ("northwind_logistics", "Organization", "Northwind Logistics", "Applicant subsidiary"),
    ("atlas_bank", "Organization", "Atlas Bank", "Lending institution"),
    ("singapore", "Location", "Singapore", "Applicant HQ jurisdiction"),
    ("frankfurt", "Location", "Frankfurt", "Lender booking centre"),
    ("term_loan_a", "Product", "Term Loan A", "EUR 25M, 5-year amortising"),
    ("revolver_b", "Product", "Revolver B", "EUR 8M committed facility"),
    ("basel_lcr", "Policy", "Basel III LCR", "Liquidity coverage ratio floor 100%"),
    ("kyc_policy", "Policy", "Enhanced KYC", "Cross-border beneficial-ownership checks"),
    ("audit_2025", "Document", "FY2025 Audited Accounts", "Filed 2026-02-14, unqualified opinion"),
    ("covenant_memo", "Document", "Covenant Waiver Memo", "Leverage covenant reset to 3.5x"),
]

EDGES = [
    ("alice_chen", "atlas_bank", "WORKS_AT"),
    ("raj_patel", "atlas_bank", "WORKS_AT"),
    ("raj_patel", "alice_chen", "REPORTS_TO"),
    ("meridian_capital", "singapore", "LOCATED_IN"),
    ("atlas_bank", "frankfurt", "LOCATED_IN"),
    ("northwind_logistics", "meridian_capital", "SUBSIDIARY_OF"),
    ("term_loan_a", "meridian_capital", "EXTENDED_TO"),
    ("revolver_b", "northwind_logistics", "EXTENDED_TO"),
    ("atlas_bank", "term_loan_a", "ORIGINATED"),
    ("atlas_bank", "revolver_b", "ORIGINATED"),
    ("term_loan_a", "basel_lcr", "GOVERNED_BY"),
    ("meridian_capital", "kyc_policy", "SUBJECT_TO"),
    ("audit_2025", "meridian_capital", "EVIDENCE_FOR"),
    ("covenant_memo", "term_loan_a", "AMENDS"),
    ("alice_chen", "meridian_capital", "MANAGES_RELATIONSHIP"),
]

DECISIONS = [
    dict(
        category="credit_approval",
        scenario="Approve EUR 25M Term Loan A for Meridian Capital",
        reasoning=(
            "FY2025 audited accounts show 2.9x leverage and 1.8x interest cover, "
            "both inside policy. Enhanced KYC cleared beneficial ownership."
        ),
        outcome="approved",
        confidence=0.88,
        entities=["meridian_capital", "term_loan_a", "audit_2025"],
        decision_maker="alice_chen",
        valid_from="2026-03-02T09:00:00+00:00",
    ),
    dict(
        category="covenant_amendment",
        scenario="Reset Term Loan A leverage covenant from 3.0x to 3.5x",
        reasoning=(
            "Acquisition of Northwind Logistics pushes pro-forma leverage to 3.3x. "
            "Headroom restored without repricing; Basel III LCR impact immaterial."
        ),
        outcome="approved_with_conditions",
        confidence=0.71,
        entities=["term_loan_a", "covenant_memo", "northwind_logistics"],
        decision_maker="raj_patel",
        valid_from="2026-06-18T09:00:00+00:00",
    ),
    dict(
        category="facility_sizing",
        scenario="Cap Revolver B at EUR 8M instead of the requested EUR 15M",
        reasoning=(
            "Post-amendment leverage leaves limited unencumbered collateral. "
            "Sizing held back pending FY2026 interim accounts."
        ),
        outcome="partially_approved",
        confidence=0.64,
        entities=["revolver_b", "northwind_logistics"],
        decision_maker="raj_patel",
        valid_from="2026-08-05T09:00:00+00:00",
    ),
]


def build() -> ContextGraph:
    graph = ContextGraph(advanced_analytics=False)

    for node_id, node_type, label, summary in NODES:
        graph.add_node(
            node_id,
            node_type=node_type,
            content=label,
            color=COLORS[node_type],
            summary=summary,
        )

    for source, target, edge_type in EDGES:
        graph.add_edge(source, target, edge_type=edge_type, weight=1.0)

    decision_ids = [graph.add_decision(**payload) for payload in DECISIONS]

    # Causal chain: approval -> covenant reset -> facility sizing.
    # record_decision already wires each decision to its category, decision
    # maker, and the entities it `involves`, so no extra edges are needed here.
    graph.add_causal_relationship(decision_ids[0], decision_ids[1], "INFLUENCED")
    graph.add_causal_relationship(decision_ids[1], decision_ids[2], "CAUSED")

    return graph


def main() -> int:
    out_path = Path(sys.argv[1] if len(sys.argv) > 1 else "demo_out/demo_graph.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    graph = build()
    graph.save_to_file(str(out_path))

    print(
        f"✓ demo graph written to {out_path} — "
        f"{len(graph.nodes)} nodes, {len(graph.edges)} edges, "
        f"{len(DECISIONS)} decisions"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
