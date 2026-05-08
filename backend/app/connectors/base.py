from dataclasses import dataclass
from typing import Protocol


@dataclass
class MetricsSnapshot:
    retention_delta_pct: float
    dau_mau_delta_pct: float
    active_users: int
    crash_free_rate: float
    p95_latency_ms: int
    ticket_volume_delta_pct: float


@dataclass
class RevenueSnapshot:
    modeled_revenue: float
    planned_revenue: float
    product_plan: dict[str, tuple[float, float]]


class ProductMetricsConnector(Protocol):
    def fetch_product_metrics(self, release_id: str) -> MetricsSnapshot:
        ...


class RevenueConnector(Protocol):
    def fetch_revenue_metrics(self, release_id: str) -> RevenueSnapshot:
        ...
