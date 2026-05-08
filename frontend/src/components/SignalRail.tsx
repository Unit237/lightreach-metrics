import type { MetricStatus } from "../types";

const HALF_SEGMENTS = 6;

function getTrendFill(status: MetricStatus): { leftFilled: number; rightFilled: number } {
  if (status === "good") {
    return { leftFilled: 0, rightFilled: HALF_SEGMENTS };
  }
  if (status === "warn") {
    return { leftFilled: 0, rightFilled: 3 };
  }
  if (status === "critical") {
    return { leftFilled: HALF_SEGMENTS, rightFilled: 0 };
  }
  return { leftFilled: 0, rightFilled: 0 };
}

export function SignalRail({ status, idPrefix }: { status: MetricStatus; idPrefix: string }) {
  const trend = getTrendFill(status);
  return (
    <div className="metric-card__trend" aria-hidden="true">
      {Array.from({ length: HALF_SEGMENTS }, (_, index) => {
        const strength = HALF_SEGMENTS - index;
        const active = index >= HALF_SEGMENTS - trend.leftFilled;
        return (
          <span
            key={`${idPrefix}-trend-left-${index}`}
            className={`metric-card__trend-segment metric-card__trend-segment--left ${
              active ? "metric-card__trend-segment--active" : ""
            }`}
            style={{ ["--trend-strength" as string]: String(strength) }}
          />
        );
      })}
      {Array.from({ length: HALF_SEGMENTS }, (_, index) => {
        const strength = index + 1;
        const active = index < trend.rightFilled;
        return (
          <span
            key={`${idPrefix}-trend-right-${index}`}
            className={`metric-card__trend-segment metric-card__trend-segment--right ${
              active ? "metric-card__trend-segment--active" : ""
            }`}
            style={{ ["--trend-strength" as string]: String(strength) }}
          />
        );
      })}
    </div>
  );
}
