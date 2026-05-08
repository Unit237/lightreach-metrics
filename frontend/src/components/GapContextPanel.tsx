import type { ReleaseReadout } from "../types";
import { SignalRail } from "./SignalRail";

interface GapContextPanelProps {
  readout: ReleaseReadout;
}

export function GapContextPanel({ readout }: GapContextPanelProps) {
  return (
    <section className="panel gap-context">
      <div className="panel__head">
        <h2>Gap Drivers + Timeline</h2>
        <p>Why v2 differs from v1 and what changed during the measured window.</p>
      </div>

      <div className="gap-context__layout">
        <div>
          <p className="gap-context__label">Top drivers</p>
          <div className="driver-list">
            {readout.top_drivers.map((driver) => (
              <article
                key={driver.id}
                className={`metric-card metric-card--${driver.direction === "upside" ? "good" : "critical"}`}
              >
                <SignalRail
                  status={driver.direction === "upside" ? "good" : "critical"}
                  idPrefix={`driver-${driver.id}`}
                />
                <div className="metric-card__header">
                  <p className="metric-card__title">{driver.label}</p>
                </div>
                <p className="metric-card__value">
                  {driver.impact_pct >= 0 ? "+" : ""}
                  {driver.impact_pct.toFixed(2)}%
                </p>
                <p className="metric-card__delta">Driver impact</p>
                <p className="metric-card__rationale">{driver.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <p className="gap-context__label">Release timeline annotations</p>
          <div className="annotation-list">
            {readout.annotations.map((annotation) => (
              <article
                key={annotation.id}
                className={`metric-card metric-card--${
                  annotation.category === "incident"
                    ? "critical"
                    : annotation.category === "deploy"
                      ? "good"
                      : annotation.category === "commercial"
                        ? "warn"
                        : "neutral"
                }`}
              >
                <SignalRail
                  status={
                    annotation.category === "incident"
                      ? "critical"
                      : annotation.category === "deploy"
                        ? "good"
                        : annotation.category === "commercial"
                          ? "warn"
                          : "neutral"
                  }
                  idPrefix={`annotation-${annotation.id}`}
                />
                <div className="metric-card__header">
                  <p className="metric-card__title">
                    {new Date(annotation.timestamp).toLocaleString()} · {annotation.category}
                  </p>
                </div>
                <p className="metric-card__value annotation-card__value">{annotation.label}</p>
                <p className="metric-card__delta">Timeline annotation</p>
                <p className="metric-card__rationale">
                  {new Date(annotation.timestamp).toLocaleString()} · {annotation.category}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
