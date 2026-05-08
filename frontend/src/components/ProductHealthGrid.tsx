import type { ProductHealth } from "../types";
import { SignalRail } from "./SignalRail";

interface ProductHealthGridProps {
  products: ProductHealth[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function ProductHealthGrid({ products }: ProductHealthGridProps) {
  return (
    <section className="product-panel panel">
      <div className="panel__head">
        <h2>Product Plan Health</h2>
        <p>Revenue contribution coverage by product against planned release targets.</p>
      </div>
      <div className="product-grid">
        {products.map((product) => (
          <article
            key={product.product_name}
            className={`metric-card metric-card--${
              product.status === "on_track" ? "good" : product.status === "at_risk" ? "warn" : "critical"
            }`}
          >
            <SignalRail
              status={product.status === "on_track" ? "good" : product.status === "at_risk" ? "warn" : "critical"}
              idPrefix={`product-${product.product_name}`}
            />
            <div className="metric-card__header">
              <p className="metric-card__title">{product.product_name}</p>
            </div>
            <p className="metric-card__value">{formatCurrency(product.actual_value)}</p>
            <p className="metric-card__delta">Plan {formatCurrency(product.plan_value)}</p>
            <p className="metric-card__rationale">{product.variance_pct.toFixed(2)}% variance</p>
          </article>
        ))}
      </div>
    </section>
  );
}
