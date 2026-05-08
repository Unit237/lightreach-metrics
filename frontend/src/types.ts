export type MetricStatus = "good" | "warn" | "critical" | "neutral";
export type Segment = "all_users" | "new_users" | "power_users" | "enterprise";
export type WindowDays = 1 | 7 | 14 | 30;

export interface MetricCardData {
  id: string;
  title: string;
  value: string;
  delta: string;
  status: MetricStatus;
  rationale: string;
}

export interface TripSignal {
  id: string;
  label: string;
  triggered: boolean;
  threshold: string;
  detail: string;
}

export interface ProductHealth {
  product_name: string;
  actual_value: number;
  plan_value: number;
  unit: string;
  variance_pct: number;
  status: "on_track" | "at_risk" | "below_plan";
}

export interface TopDriver {
  id: string;
  label: string;
  impact_pct: number;
  direction: "upside" | "downside";
  detail: string;
}

export interface ReleaseAnnotation {
  id: string;
  timestamp: string;
  label: string;
  category: "deploy" | "incident" | "experiment" | "commercial";
}

export interface ReleaseReadout {
  client_id: string;
  client_name: string;
  release_id: string;
  requested_release_id: string;
  source_branch: string | null;
  source_commit_sha: string | null;
  source_commit_short: string | null;
  release_context_key: string;
  environment: "staging" | "production";
  segment: Segment;
  window_days: WindowDays;
  generated_at: string;
  headline: string;
  cards: MetricCardData[];
  active_users: number;
  retention_delta_pct: number;
  dau_mau_delta_pct: number;
  revenue_gap_pct: number;
  products_below_plan_count: number;
  tripped_signals: TripSignal[];
  product_health: ProductHealth[];
  top_drivers: TopDriver[];
  annotations: ReleaseAnnotation[];
  recommended_actions: string[];
}

export interface ReleaseBranch {
  name: string;
  commit_short: string;
  is_current: boolean;
  role: "baseline" | "experiment" | "other";
  source: "github" | "local";
}

export interface ReleaseBranchInventory {
  client_id: string;
  client_name: string;
  source: "github" | "local";
  branches: ReleaseBranch[];
  baseline_branches: ReleaseBranch[];
  experiment_branches: ReleaseBranch[];
}

export interface ClientProfileSummary {
  client_id: string;
  client_name: string;
  github_owner: string | null;
  github_repo: string | null;
  has_signal_webhook: boolean;
}
