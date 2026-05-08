from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class MetricCard(BaseModel):
    id: str
    title: str
    value: str
    delta: str
    status: Literal["good", "warn", "critical", "neutral"]
    rationale: str


class ProductHealth(BaseModel):
    product_name: str
    actual_value: float
    plan_value: float
    unit: str
    variance_pct: float
    status: Literal["on_track", "at_risk", "below_plan"]


class TripSignal(BaseModel):
    id: str
    label: str
    triggered: bool
    threshold: str
    detail: str


class TopDriver(BaseModel):
    id: str
    label: str
    impact_pct: float
    direction: Literal["upside", "downside"]
    detail: str


class ReleaseAnnotation(BaseModel):
    id: str
    timestamp: datetime
    label: str
    category: Literal["deploy", "incident", "experiment", "commercial"]


class ReleaseReadout(BaseModel):
    client_id: str
    client_name: str
    release_id: str
    requested_release_id: str
    source_branch: str | None = None
    source_commit_sha: str | None = None
    source_commit_short: str | None = None
    release_context_key: str
    environment: Literal["staging", "production"]
    segment: Literal["all_users", "new_users", "power_users", "enterprise"]
    window_days: Literal[1, 7, 14, 30]
    generated_at: datetime
    headline: str
    cards: list[MetricCard]
    active_users: int = Field(ge=0)
    retention_delta_pct: float
    dau_mau_delta_pct: float
    revenue_gap_pct: float
    products_below_plan_count: int = Field(ge=0)
    tripped_signals: list[TripSignal]
    product_health: list[ProductHealth]
    top_drivers: list[TopDriver]
    annotations: list[ReleaseAnnotation]
    recommended_actions: list[str]


class ReleaseBranch(BaseModel):
    name: str
    commit_short: str
    is_current: bool
    role: Literal["baseline", "experiment", "other"]
    source: Literal["github", "local"]


class ReleaseBranchInventory(BaseModel):
    client_id: str
    client_name: str
    source: Literal["github", "local"]
    branches: list[ReleaseBranch]
    baseline_branches: list[ReleaseBranch]
    experiment_branches: list[ReleaseBranch]


class ClientProfileSummary(BaseModel):
    client_id: str
    client_name: str
    github_owner: str | None = None
    github_repo: str | None = None
    has_signal_webhook: bool = False
