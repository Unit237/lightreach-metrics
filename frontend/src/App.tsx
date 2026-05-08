import { useEffect, useMemo, useState } from "react";
import { getClientProfiles, getReleaseBranches, getReleaseReadout } from "./api/releaseReadoutApi";
import { getMockReleaseReadout } from "./data/mockReadouts";
import { GapContextPanel } from "./components/GapContextPanel";
import { MetricCard } from "./components/MetricCard";
import { ProductHealthGrid } from "./components/ProductHealthGrid";
import { TripBanner } from "./components/TripBanner";
import { VersionDiffPanel } from "./components/VersionDiffPanel";
import type {
  MetricCardData,
  ClientProfileSummary,
  ReleaseBranch,
  ReleaseBranchInventory,
  ReleaseReadout,
  Segment,
  WindowDays
} from "./types";

const defaultCurrentReleaseId = "v2_2026_05_06";
const defaultPreviousReleaseId = "v1_2026_04_29";
const AUTO_REFRESH_MS = 10000;
const DEFAULT_METRIC_IDS = [
  "retention",
  "dau-mau",
  "active-users",
  "revenue-gap",
  "crash-free-rate",
  "latency",
  "error-rate",
  "ticket-volume",
  "guardrail-pressure",
  "plan-coverage"
];
const FALLBACK_VISIBLE_COUNT = 6;

function statusFromBounds(value: number, goodFloor: number, warnFloor: number): MetricCardData["status"] {
  if (value >= goodFloor) {
    return "good";
  }
  if (value >= warnFloor) {
    return "warn";
  }
  return "critical";
}

interface ReadoutResult {
  data: ReleaseReadout;
  source: "api" | "mock";
}

async function getReadoutWithFallback(
  releaseId: string,
  clientId: string | null,
  environment: "production" | "staging",
  segment: Segment,
  windowDays: WindowDays
): Promise<ReadoutResult> {
  try {
    const data = await getReleaseReadout(releaseId, clientId, environment, segment, windowDays);
    return { data, source: "api" };
  } catch {
    return {
      data: getMockReleaseReadout(releaseId, environment, segment, windowDays),
      source: "mock"
    };
  }
}

export default function App() {
  const [clientProfiles, setClientProfiles] = useState<ClientProfileSummary[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [currentReleaseId, setCurrentReleaseId] = useState(defaultCurrentReleaseId);
  const [previousReleaseId, setPreviousReleaseId] = useState(defaultPreviousReleaseId);
  const [environment, setEnvironment] = useState<"production" | "staging">("production");
  const [segment, setSegment] = useState<Segment>("all_users");
  const [windowDays, setWindowDays] = useState<WindowDays>(7);
  const [currentData, setCurrentData] = useState<ReleaseReadout | null>(null);
  const [previousData, setPreviousData] = useState<ReleaseReadout | null>(null);
  const [branchInventory, setBranchInventory] = useState<ReleaseBranchInventory | null>(null);
  const [hasAutoMappedBranches, setHasAutoMappedBranches] = useState(false);
  const [dataSource, setDataSource] = useState<"api" | "mock">("api");
  const [loading, setLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [visibleMetricIds, setVisibleMetricIds] = useState<string[]>([]);
  const [hasInitializedMetricSet, setHasInitializedMetricSet] = useState(false);
  const [selectedMetricId, setSelectedMetricId] = useState("");

  useEffect(() => {
    let active = true;
    getClientProfiles()
      .then((profiles) => {
        if (!active) {
          return;
        }
        setClientProfiles(profiles);
        if (!profiles.length) {
          return;
        }
        if (!selectedClientId || !profiles.some((client) => client.client_id === selectedClientId)) {
          setSelectedClientId(profiles[0].client_id);
          setHasAutoMappedBranches(false);
        }
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setClientProfiles([]);
      });
    return () => {
      active = false;
    };
  }, [selectedClientId]);

  useEffect(() => {
    let active = true;
    if (!selectedClientId) {
      setBranchInventory(null);
      return () => {
        active = false;
      };
    }
    getReleaseBranches(selectedClientId)
      .then((inventory) => {
        if (!active) {
          return;
        }
        setBranchInventory(inventory);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setBranchInventory(null);
      });
    return () => {
      active = false;
    };
  }, [selectedClientId]);

  useEffect(() => {
    if (hasAutoMappedBranches || !branchInventory) {
      return;
    }
    const experimentBranches = branchInventory.experiment_branches;
    const baselineBranches = branchInventory.baseline_branches;
    const allBranches = branchInventory.branches;
    const currentBranch =
      experimentBranches.find((branch) => branch.is_current)?.name ??
      allBranches.find((branch) => branch.is_current)?.name ??
      experimentBranches[0]?.name;
    const baselineBranch =
      baselineBranches[0]?.name ??
      allBranches.find((branch) => ["main", "master", "trunk"].includes(branch.name.toLowerCase()))?.name ??
      allBranches.find((branch) => branch.name !== currentBranch)?.name;

    if (currentReleaseId === defaultCurrentReleaseId && currentBranch) {
      setCurrentReleaseId(currentBranch);
    }
    if (previousReleaseId === defaultPreviousReleaseId && baselineBranch) {
      setPreviousReleaseId(baselineBranch);
    }
    setHasAutoMappedBranches(true);
  }, [branchInventory, currentReleaseId, hasAutoMappedBranches, previousReleaseId]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setRefreshTick((value) => value + 1);
    }, AUTO_REFRESH_MS);
    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([
      getReadoutWithFallback(currentReleaseId, selectedClientId, environment, segment, windowDays),
      getReadoutWithFallback(previousReleaseId, selectedClientId, environment, segment, windowDays)
    ])
      .then(([currentResult, previousResult]) => {
        if (!active) {
          return;
        }
        setCurrentData(currentResult.data);
        setPreviousData(previousResult.data);
        setDataSource(currentResult.source === "api" && previousResult.source === "api" ? "api" : "mock");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentReleaseId, previousReleaseId, selectedClientId, environment, segment, windowDays, refreshTick]);

  const generatedText = useMemo(() => {
    if (!currentData) {
      return "";
    }
    return new Date(currentData.generated_at).toLocaleString();
  }, [currentData]);

  const supplementalMetrics = useMemo<MetricCardData[]>(() => {
    if (!currentData || !previousData) {
      return [];
    }
    const guardrailTrips = currentData.tripped_signals.filter((signal) => signal.triggered).length;
    const planCoverage = currentData.product_health.length
      ? ((currentData.product_health.length - currentData.products_below_plan_count) /
          currentData.product_health.length) *
        100
      : 100;
    const baselineRevenueDelta = currentData.revenue_gap_pct - previousData.revenue_gap_pct;
    return [
      {
        id: "guardrail-pressure",
        title: "Guardrail Pressure",
        value: `${guardrailTrips}`,
        delta: "Triggered regression safeguards",
        status: guardrailTrips === 0 ? "good" : guardrailTrips <= 1 ? "warn" : "critical",
        rationale: "Fast indicator of release health breaches requiring intervention."
      },
      {
        id: "plan-coverage",
        title: "Plan Coverage",
        value: `${planCoverage.toFixed(1)}%`,
        delta: "Products tracking to plan",
        status: statusFromBounds(planCoverage, 90, 75),
        rationale: "Share of product lines currently above the release plan floor."
      },
      {
        id: "baseline-revenue-swing",
        title: "Revenue Swing vs Baseline",
        value: `${baselineRevenueDelta >= 0 ? "+" : ""}${baselineRevenueDelta.toFixed(2)}pp`,
        delta: "Change in variance versus baseline release",
        status: baselineRevenueDelta >= 0 ? "good" : baselineRevenueDelta >= -1 ? "warn" : "critical",
        rationale: "Direction of commercial movement compared with the baseline branch."
      }
    ];
  }, [currentData, previousData]);

  const allMetrics = useMemo<MetricCardData[]>(() => {
    if (!currentData) {
      return [];
    }
    return [...currentData.cards, ...supplementalMetrics];
  }, [currentData, supplementalMetrics]);

  useEffect(() => {
    if (!allMetrics.length) {
      return;
    }
    if (!hasInitializedMetricSet) {
      const preferred = DEFAULT_METRIC_IDS.filter((id) => allMetrics.some((metric) => metric.id === id));
      const bootstrap = preferred.length
        ? preferred
        : allMetrics.slice(0, Math.min(FALLBACK_VISIBLE_COUNT, allMetrics.length)).map((metric) => metric.id);
      setVisibleMetricIds(bootstrap);
      setHasInitializedMetricSet(true);
      return;
    }
    const allowed = new Set(allMetrics.map((metric) => metric.id));
    const nextVisible = visibleMetricIds.filter((id) => allowed.has(id));
    if (nextVisible.length !== visibleMetricIds.length) {
      setVisibleMetricIds(nextVisible);
    }
  }, [allMetrics, hasInitializedMetricSet, visibleMetricIds]);

  const visibleMetrics = allMetrics.filter((metric) => visibleMetricIds.includes(metric.id));
  const hiddenMetrics = allMetrics.filter((metric) => !visibleMetricIds.includes(metric.id));

  const manualCurrentOption: ReleaseBranch = {
    name: currentReleaseId,
    commit_short: "manual",
    is_current: false,
    role: "other",
    source: "local",
  };
  const manualBaselineOption: ReleaseBranch = {
    name: previousReleaseId,
    commit_short: "manual",
    is_current: false,
    role: "other",
    source: "local",
  };
  const rawCurrentOptions =
    branchInventory?.experiment_branches.length
      ? branchInventory.experiment_branches
      : (branchInventory?.branches ?? [manualCurrentOption]);
  const rawBaselineOptions =
    branchInventory?.baseline_branches.length
      ? branchInventory.baseline_branches
      : (branchInventory?.branches ?? [manualBaselineOption]);
  const currentBranchOptions = rawCurrentOptions.some((branch) => branch.name === currentReleaseId)
    ? rawCurrentOptions
    : [manualCurrentOption, ...rawCurrentOptions];
  const baselineBranchOptions = rawBaselineOptions.some((branch) => branch.name === previousReleaseId)
    ? rawBaselineOptions
    : [manualBaselineOption, ...rawBaselineOptions];
  const hasBranchOptions = Boolean(branchInventory);

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="brand">Lightreach Metrics</div>
        <div className="scope-card">
          <header className="scope-card__header">
            <p className="scope-card__eyebrow">Comparison</p>
            <h2 className="scope-card__title">Release scope</h2>
            <p className="scope-card__hint">
              Git branch/version scope mapped to PostHog/Sentry release context for controlled experiments.
            </p>
          </header>
          <div className="scope-card__fields">
            <div className="field">
              <label className="field__label" htmlFor="scope-client">
                Client workspace
              </label>
              <select
                id="scope-client"
                className="field__control"
                value={selectedClientId ?? ""}
                onChange={(e) => {
                  setSelectedClientId(e.target.value || null);
                  setHasAutoMappedBranches(false);
                }}
                disabled={!clientProfiles.length}
              >
                {clientProfiles.length ? null : <option value="">No clients configured</option>}
                {clientProfiles.map((client) => (
                  <option key={client.client_id} value={client.client_id}>
                    {client.client_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="release-current">
                Current branch/version
              </label>
              <select
                id="release-current"
                className="field__control"
                value={currentReleaseId}
                onChange={(e) => setCurrentReleaseId(e.target.value)}
                disabled={currentBranchOptions.length === 0}
              >
                {currentBranchOptions.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name} ({branch.commit_short})
                  </option>
                ))}
              </select>
              {currentData?.source_branch ? (
                <p className="field__meta">
                  Resolved: {currentData.source_branch}@{currentData.source_commit_short}
                </p>
              ) : null}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="release-baseline">
                Baseline branch/version
              </label>
              <select
                id="release-baseline"
                className="field__control"
                value={previousReleaseId}
                onChange={(e) => setPreviousReleaseId(e.target.value)}
                disabled={baselineBranchOptions.length === 0}
              >
                {baselineBranchOptions.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name} ({branch.commit_short})
                  </option>
                ))}
              </select>
              {previousData?.source_branch ? (
                <p className="field__meta">
                  Resolved: {previousData.source_branch}@{previousData.source_commit_short}
                </p>
              ) : null}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="scope-environment">
                Environment
              </label>
              <select
                id="scope-environment"
                className="field__control"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as "production" | "staging")}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="scope-segment">
                Segment
              </label>
              <select
                id="scope-segment"
                className="field__control"
                value={segment}
                onChange={(e) => setSegment(e.target.value as Segment)}
              >
                <option value="all_users">All users</option>
                <option value="new_users">New users</option>
                <option value="power_users">Power users</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="scope-window">
                Post-release window
              </label>
              <select
                id="scope-window"
                className="field__control"
                value={windowDays}
                onChange={(e) => setWindowDays(Number(e.target.value) as WindowDays)}
              >
                <option value={1}>D1</option>
                <option value={7}>D7</option>
                <option value={14}>D14</option>
                <option value={30}>D30</option>
              </select>
            </div>
          </div>
          {hasBranchOptions ? (
            <p className="scope-card__meta">
              Source: {branchInventory?.source}. {branchInventory?.experiment_branches.length ?? 0} experiment
              branches saved for future runs; baseline defaults to mainline.
            </p>
          ) : (
            <p className="scope-card__meta">
              Branch inventory unavailable. Configure GitHub with GITHUB_OWNER and GITHUB_REPO to enable typed
              branch scope.
            </p>
          )}
        </div>
        <div className="sidebar-foot">
          <p className={`source-badge ${dataSource === "mock" ? "source-badge--mock" : "source-badge--api"}`}>
            {dataSource === "mock"
              ? "Using local mock readout (backend unavailable)"
              : "Using live release API data"}
          </p>
        </div>
      </aside>

      <section className="content">
        <header className="hero">
          <p className="dashboard__eyebrow">The Loop / Release Intelligence</p>
          <h1>Release intelligence command center</h1>
          <p className="dashboard__subtitle">
            Executive-grade readout for product adoption, software quality, and commercial movement after each ship.
          </p>
        </header>

        {loading ? <p className="state-line">Loading release readout...</p> : null}

        {currentData && previousData ? (
          <>
            <section className="headline-box panel">
              <p>{currentData.headline}</p>
              <p className="headline-box__meta">Workspace: {currentData.client_name}</p>
              <p className="headline-box__meta">
                Context: {segment.replace("_", " ")} segment · D{windowDays} post-release window
              </p>
              {currentData.source_branch ? (
                <p className="headline-box__meta">
                  Current scope resolved from branch <strong>{currentData.source_branch}</strong> @{" "}
                  <strong>{currentData.source_commit_short}</strong>.
                </p>
              ) : null}
            </section>
            <TripBanner signals={currentData.tripped_signals} />

            <section className="panel panel--metrics-hero" aria-labelledby="metrics-hero-title">
              <div className="panel__head panel__head--hero">
                <p className="metrics-hero__eyebrow">Executive release scorecard</p>
                <h2 className="metrics-hero__title" id="metrics-hero-title">
                  {currentData.release_id}
                </h2>
                <p className="metrics-hero__lede">
                  A single-row performance strip for adoption, reliability, and commercial outcomes, designed for fast
                  operating decisions.
                </p>
                <p className="metrics-hero__sync">Live sync every 10s · Last updated {generatedText}</p>
                <div className="metrics-controls">
                  <label className="metrics-controls__label" htmlFor="metric-selector">
                    Extend scorecard
                  </label>
                  <select
                    id="metric-selector"
                    className="metrics-controls__select"
                    value={selectedMetricId}
                    onChange={(e) => {
                      const nextMetricId = e.target.value;
                      if (!nextMetricId) {
                        return;
                      }
                      setVisibleMetricIds((prev) => (prev.includes(nextMetricId) ? prev : [...prev, nextMetricId]));
                      setSelectedMetricId("");
                    }}
                  >
                    <option value="">Select additional metric</option>
                    {hiddenMetrics.map((metric) => (
                      <option key={metric.id} value={metric.id}>
                        {metric.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="metric-grid-wrap">
                <div className="metric-grid metric-grid--hero">
                  {visibleMetrics.map((card) => (
                    <MetricCard
                      key={card.id}
                      card={card}
                      onRemove={(metricId) =>
                        setVisibleMetricIds((currentIds) => currentIds.filter((id) => id !== metricId))
                      }
                    />
                  ))}
                </div>
              </div>
            </section>

            <VersionDiffPanel current={currentData} previous={previousData} />
            <GapContextPanel readout={currentData} />

            <ProductHealthGrid products={currentData.product_health} />

            <section className="actions-panel panel">
              <h2>Recommended Actions</h2>
              <ul>
                {currentData.recommended_actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </section>

            <section className="stack-panel panel">
              <h2>Recommended Measurement Stack</h2>
              <p>
                PostHog + Sentry is the base layer. Add warehouse metrics (BigQuery/Snowflake + dbt), billing telemetry
                (Stripe), and CRM context (HubSpot/Salesforce) to quantify release impact on commercial outcomes.
              </p>
              <p className="stack-panel__meta">Generated {generatedText}</p>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}
