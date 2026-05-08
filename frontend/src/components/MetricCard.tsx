import type { MetricCardData, MetricStatus } from "../types";
import { SignalRail } from "./SignalRail";

interface MetricCardProps {
  card: MetricCardData;
  onRemove?: (metricId: string) => void;
}

const statusClass: Record<MetricStatus, string> = {
  good: "metric-card--good",
  warn: "metric-card--warn",
  critical: "metric-card--critical",
  neutral: "metric-card--neutral"
};

export function MetricCard({ card, onRemove }: MetricCardProps) {
  return (
    <article className={`metric-card ${statusClass[card.status]}`}>
      <SignalRail status={card.status} idPrefix={card.id} />
      <div className="metric-card__header">
        <p className="metric-card__title">{card.title}</p>
        {onRemove ? (
          <button
            type="button"
            className="metric-card__remove"
            onClick={() => onRemove(card.id)}
            aria-label={`Remove ${card.title}`}
            title={`Remove ${card.title}`}
          >
            ×
          </button>
        ) : null}
      </div>
      <p className="metric-card__value">{card.value}</p>
      <p className="metric-card__delta">{card.delta}</p>
      <p className="metric-card__rationale">{card.rationale}</p>
    </article>
  );
}
