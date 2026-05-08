import type {
  MetricCardData,
  ProductHealth,
  ReleaseAnnotation,
  ReleaseReadout,
  Segment,
  TopDriver,
  TripSignal,
  WindowDays
} from "../types";

function seededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function cardStatus(value: number, warnFloor: number, criticalFloor: number): MetricCardData["status"] {
  if (value <= criticalFloor) {
    return "critical";
  }
  if (value <= warnFloor) {
    return "warn";
  }
  return "good";
}

function buildTripSignals(revenueGapPct: number, productsBelowPlanCount: number): TripSignal[] {
  return [
    {
      id: "revenue-gap",
      label: "Revenue proxy",
      triggered: revenueGapPct <= -1,
      threshold: ">= 1% under plan",
      detail: `${revenueGapPct.toFixed(2)}% vs full plan`
    },
    {
      id: "products-below-plan",
      label: "Products below plan",
      triggered: productsBelowPlanCount >= 1,
      threshold: ">= 1 product",
      detail: `${productsBelowPlanCount} product(s) below plan`
    }
  ];
}

function buildProductHealth(rand: () => number): ProductHealth[] {
  const baseline: Array<[string, number]> = [
    ["Onboarding", 15000],
    ["Messaging", 13000],
    ["Billing", 24000],
    ["Assistant", 32000],
    ["Search", 18000],
    ["Analytics", 23000]
  ];

  return baseline.map(([name, plan]) => {
    const variancePct = -11 + rand() * 15;
    const actual = plan * (1 + variancePct / 100);
    const status: ProductHealth["status"] =
      variancePct < -8 ? "below_plan" : variancePct < -3 ? "at_risk" : "on_track";
    return {
      product_name: name,
      actual_value: Math.round(actual),
      plan_value: plan,
      unit: "USD",
      variance_pct: Number(variancePct.toFixed(2)),
      status
    };
  });
}

export function getMockReleaseReadout(
  releaseId: string,
  environment: "staging" | "production",
  segment: Segment,
  windowDays: WindowDays
): ReleaseReadout {
  const seed = releaseId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const mockCommitShort = Math.abs(seed).toString(16).padStart(8, "0").slice(0, 8);
  const releaseContextKey = releaseId.trim().replace(/\s+/g, "_");
  const isBranchLike = /^[A-Za-z0-9._/-]+$/.test(releaseId) && releaseId.includes("/");
  const rand = seededRandom(seed + (environment === "production" ? 71 : 35) + windowDays);

  const segmentMultiplier: Record<Segment, number> = {
    all_users: 1,
    new_users: 1.09,
    power_users: 0.95,
    enterprise: 0.9
  };
  const windowMultiplier: Record<WindowDays, number> = {
    1: 0.72,
    7: 1,
    14: 1.06,
    30: 1.13
  };
  const scopeFactor = segmentMultiplier[segment] * windowMultiplier[windowDays];

  const retentionDelta = Number(((42 + rand() * 24) * scopeFactor).toFixed(2));
  const dauMauDelta = Number(((14 + rand() * 16) * scopeFactor).toFixed(2));
  const activeUsers = Math.round((112 + rand() * 70) * Math.max(0.7, scopeFactor));
  const revenueGapPct = Number(((-15 + rand() * 9) / windowMultiplier[windowDays]).toFixed(2));
  const crashFreeRate = Number((98.5 + rand() * 1.1).toFixed(2));
  const p95Latency = 185 + Math.round((rand() * 55) / segmentMultiplier[segment]);
  const sentryErrorDelta = Number((-19 + rand() * 14).toFixed(2));
  const ticketTrend = Number((-13 + rand() * 10).toFixed(2));
  const productHealth = buildProductHealth(rand);
  const productsBelowPlanCount = productHealth.filter((item) => item.status === "below_plan").length;

  const cards: MetricCardData[] = [
    {
      id: "retention",
      title: "Retention Lift",
      value: `+${retentionDelta.toFixed(2)}%`,
      delta: "Versus prior release cohort",
      status: cardStatus(retentionDelta, 10, 0),
      rationale: "Core stickiness signal for release product-market confidence."
    },
    {
      id: "dau-mau",
      title: "Engagement Depth",
      value: `+${dauMauDelta.toFixed(2)}%`,
      delta: "DAU/MAU movement",
      status: cardStatus(dauMauDelta, 5, 0),
      rationale: "Indicates habit strength and sustained return behavior."
    },
    {
      id: "active-users",
      title: "Active Reach",
      value: `${activeUsers}`,
      delta: "7-day active user count",
      status: activeUsers >= 120 ? "good" : "warn",
      rationale: "Measures the breadth of adoption during the release window."
    },
    {
      id: "revenue-gap",
      title: "Revenue Plan Variance",
      value: `${revenueGapPct.toFixed(2)}%`,
      delta: "Versus modeled release plan",
      status: cardStatus(revenueGapPct, -1, -4),
      rationale: "Early commercial read before month-end finance close."
    },
    {
      id: "crash-free-rate",
      title: "Runtime Stability",
      value: `${crashFreeRate.toFixed(2)}%`,
      delta: "Crash-free session rate",
      status: crashFreeRate >= 99 ? "good" : "warn",
      rationale: "Reliability trust indicator for shipped code paths."
    },
    {
      id: "latency",
      title: "Interaction Latency (P95)",
      value: `${p95Latency} ms`,
      delta: "API and client response delay",
      status: p95Latency <= 220 ? "good" : "warn",
      rationale: "Performance drift is a lead indicator of churn risk."
    },
    {
      id: "error-rate",
      title: "Error Pressure",
      value: `${sentryErrorDelta >= 0 ? "+" : ""}${sentryErrorDelta.toFixed(2)}%`,
      delta: "Error-rate change versus baseline",
      status: sentryErrorDelta <= -6 ? "good" : sentryErrorDelta <= 0 ? "warn" : "critical",
      rationale: "Production error heat on release-specific pathways."
    },
    {
      id: "ticket-volume",
      title: "Support Friction",
      value: `${ticketTrend >= 0 ? "+" : ""}${ticketTrend.toFixed(2)}%`,
      delta: "Ticket-volume direction",
      status: ticketTrend < 0 ? "good" : "warn",
      rationale: "Tracks customer-visible friction introduced by the release."
    }
  ];

  const topDrivers: TopDriver[] = [
    {
      id: "onboarding",
      label: "Onboarding conversion",
      impact_pct: -4.3,
      direction: "downside",
      detail: "Fewer first-session completions in checkout handoff."
    },
    {
      id: "assistant",
      label: "Assistant adoption",
      impact_pct: 2.5,
      direction: "upside",
      detail: "Higher repeat use among users exposed to assistant prompts."
    },
    {
      id: "billing",
      label: "Billing reliability",
      impact_pct: -2.9,
      direction: "downside",
      detail: "Retry and invoice sync errors reduced modeled conversion."
    }
  ];

  const now = new Date();
  const annotations: ReleaseAnnotation[] = [
    {
      id: "deploy",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 20).toISOString(),
      label: "v2 release deployed to production",
      category: "deploy"
    },
    {
      id: "experiment",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 9).toISOString(),
      label: "Assistant flag rollout moved from 20% to 45%",
      category: "experiment"
    },
    {
      id: "incident",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 4).toISOString(),
      label: "Short-lived search latency incident",
      category: "incident"
    }
  ];

  return {
    client_id: "local-demo",
    client_name: "Local Demo Workspace",
    release_id: releaseContextKey,
    requested_release_id: releaseId,
    source_branch: isBranchLike ? releaseId : null,
    source_commit_sha: isBranchLike ? `${mockCommitShort}mock${mockCommitShort}` : null,
    source_commit_short: isBranchLike ? mockCommitShort : null,
    release_context_key: releaseContextKey,
    environment,
    segment,
    window_days: windowDays,
    generated_at: new Date().toISOString(),
    headline: `Release readout: retention +${retentionDelta.toFixed(2)}% · DAU/MAU +${dauMauDelta.toFixed(
      2
    )}% · ${activeUsers} users · modeled revenue gap ${revenueGapPct.toFixed(
      2
    )}% vs full plan · segment ${segment} · D${windowDays}`,
    cards,
    active_users: activeUsers,
    retention_delta_pct: retentionDelta,
    dau_mau_delta_pct: dauMauDelta,
    revenue_gap_pct: revenueGapPct,
    products_below_plan_count: productsBelowPlanCount,
    tripped_signals: buildTripSignals(revenueGapPct, productsBelowPlanCount),
    product_health: productHealth,
    top_drivers: topDrivers,
    annotations,
    recommended_actions: [
      "Re-open engineering pipeline for recovery workstream where critical metrics regressed.",
      "Prioritize quick wins in onboarding and assistant flows for next point release.",
      "Gate rollout expansion until reliability and revenue proxy clear target bands.",
      "Run release readout in 24h with growth + product + engineering leadership."
    ]
  };
}
