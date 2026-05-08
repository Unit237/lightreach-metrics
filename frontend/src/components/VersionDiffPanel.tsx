import type { ReleaseReadout } from "../types";
import { SignalRail } from "./SignalRail";

interface VersionDiffPanelProps {
  current: ReleaseReadout;
  previous: ReleaseReadout;
}

interface DiffRow {
  id: string;
  label: string;
  v1: number;
  v2: number;
  unit: "%" | "users";
  positiveIsGood: boolean;
}

function confidenceBand(absDiff: number, unit: "%" | "users"): "high" | "medium" | "low" {
  if (unit === "users") {
    if (absDiff >= 20) {
      return "high";
    }
    if (absDiff >= 8) {
      return "medium";
    }
    return "low";
  }
  if (absDiff >= 4) {
    return "high";
  }
  if (absDiff >= 1.5) {
    return "medium";
  }
  return "low";
}

function formatMetric(value: number, unit: "%" | "users"): string {
  if (unit === "users") {
    return `${Math.round(value)}`;
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function VersionDiffPanel({ current, previous }: VersionDiffPanelProps) {
  const rows: DiffRow[] = [
    {
      id: "retention",
      label: "Retention delta",
      v1: previous.retention_delta_pct,
      v2: current.retention_delta_pct,
      unit: "%",
      positiveIsGood: true
    },
    {
      id: "dau-mau",
      label: "DAU/MAU delta",
      v1: previous.dau_mau_delta_pct,
      v2: current.dau_mau_delta_pct,
      unit: "%",
      positiveIsGood: true
    },
    {
      id: "active-users",
      label: "Active users",
      v1: previous.active_users,
      v2: current.active_users,
      unit: "users",
      positiveIsGood: true
    },
    {
      id: "revenue-gap",
      label: "Revenue gap vs plan",
      v1: previous.revenue_gap_pct,
      v2: current.revenue_gap_pct,
      unit: "%",
      positiveIsGood: true
    },
    {
      id: "products-below-plan",
      label: "Products below plan",
      v1: previous.products_below_plan_count,
      v2: current.products_below_plan_count,
      unit: "users",
      positiveIsGood: false
    }
  ];

  return (
    <section className="panel panel--diff-secondary">
      <div className="panel__head panel__head--compact">
        <p className="panel__eyebrow">Baseline comparison</p>
        <h2>Version diff</h2>
        <p>
          Compare <strong>{previous.release_id}</strong> against <strong>{current.release_id}</strong> for{" "}
          <strong>{current.segment.replace("_", " ")}</strong> over <strong>D{current.window_days}</strong>.
        </p>
      </div>
      <div className="diff-grid">
        {rows.map((row) => {
          const diff = row.v2 - row.v1;
          const favorable = row.positiveIsGood ? diff >= 0 : diff <= 0;
          const confidence = confidenceBand(Math.abs(diff), row.unit);
          const status = favorable ? "good" : "critical";
          return (
            <article key={row.id} className={`metric-card metric-card--${status}`}>
              <SignalRail status={status} idPrefix={`diff-${row.id}`} />
              <div className="metric-card__header">
                <p className="metric-card__title">{row.label}</p>
              </div>
              <p className="metric-card__value">
                {formatMetric(diff, row.unit === "users" ? "users" : "%")}
              </p>
              <p className="metric-card__delta">
                v1 {formatMetric(row.v1, row.unit)} {"->"} v2 {formatMetric(row.v2, row.unit)}
              </p>
              <p className="metric-card__rationale">
                Confidence: {confidence}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
