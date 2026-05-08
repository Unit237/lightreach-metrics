from datetime import datetime, timezone
from typing import Literal

from app.connectors.base import MetricsSnapshot, RevenueSnapshot
from app.connectors.posthog import PostHogConnector
from app.connectors.revenue import RevenueModelConnector
from app.connectors.sentry import SentryConnector
from app.models import (
    ClientProfileSummary,
    MetricCard,
    ProductHealth,
    ReleaseAnnotation,
    ReleaseReadout,
    TopDriver,
    TripSignal,
)
from app.services.client_profiles import ClientProfileStore
from app.services.release_scope import ReleaseScopeResolver
from app.services.signal_dispatcher import SignalDispatcher


def _status_from_delta(value: float, warn_floor: float, critical_floor: float) -> str:
    if value <= critical_floor:
        return "critical"
    if value <= warn_floor:
        return "warn"
    return "good"


def _format_pct(value: float) -> str:
    sign = "+" if value >= 0 else ""
    return f"{sign}{value:.2f}%"


class ReleaseReadoutService:
    def __init__(
        self,
        product_connector: PostHogConnector | None = None,
        quality_connector: SentryConnector | None = None,
        revenue_connector: RevenueModelConnector | None = None,
        scope_resolver: ReleaseScopeResolver | None = None,
        signal_dispatcher: SignalDispatcher | None = None,
        client_profile_store: ClientProfileStore | None = None,
    ) -> None:
        self.product_connector = product_connector or PostHogConnector()
        self.quality_connector = quality_connector or SentryConnector()
        self.revenue_connector = revenue_connector or RevenueModelConnector()
        self.scope_resolver = scope_resolver or ReleaseScopeResolver()
        self.signal_dispatcher = signal_dispatcher or SignalDispatcher()
        self.client_profile_store = client_profile_store or ClientProfileStore()

    def list_client_profiles(self) -> list[ClientProfileSummary]:
        profiles = self.client_profile_store.list_profiles()
        return [
            ClientProfileSummary(
                client_id=profile.client_id,
                client_name=profile.client_name,
                github_owner=profile.github_owner,
                github_repo=profile.github_repo,
                has_signal_webhook=bool(profile.signal_webhook_url),
            )
            for profile in profiles
        ]

    def build_release_readout(
        self,
        release_id: str,
        client_id: str | None = None,
        environment: Literal["production", "staging"] = "production",
        segment: Literal["all_users", "new_users", "power_users", "enterprise"] = "all_users",
        window_days: Literal[1, 7, 14, 30] = 7,
    ) -> ReleaseReadout:
        client_profile = self.client_profile_store.get_client_profile(client_id)
        resolved_scope = self.scope_resolver.resolve_release_scope(release_id, client_profile=client_profile)
        context_release_id = f"{resolved_scope.release_context_key}:{segment}:{window_days}"
        metrics: MetricsSnapshot = self.product_connector.fetch_product_metrics(context_release_id)
        quality = self.quality_connector.fetch_quality_metrics(context_release_id)
        revenue: RevenueSnapshot = self.revenue_connector.fetch_revenue_metrics(context_release_id)

        segment_multiplier = {
            "all_users": 1.0,
            "new_users": 1.08,
            "power_users": 0.93,
            "enterprise": 0.89,
        }.get(segment, 1.0)
        window_multiplier = {
            1: 0.72,
            7: 1.0,
            14: 1.05,
            30: 1.12,
        }.get(window_days, 1.0)

        metrics.retention_delta_pct = round(metrics.retention_delta_pct * segment_multiplier * window_multiplier, 2)
        metrics.dau_mau_delta_pct = round(metrics.dau_mau_delta_pct * segment_multiplier * window_multiplier, 2)
        metrics.active_users = int(metrics.active_users * max(0.68, segment_multiplier) * window_multiplier)
        metrics.p95_latency_ms = int(metrics.p95_latency_ms / max(0.84, segment_multiplier))
        metrics.ticket_volume_delta_pct = round(metrics.ticket_volume_delta_pct / window_multiplier, 2)
        quality["error_rate_delta_pct"] = round(quality["error_rate_delta_pct"] / segment_multiplier, 2)

        revenue_gap_pct = ((revenue.modeled_revenue - revenue.planned_revenue) / revenue.planned_revenue) * 100
        revenue_gap_pct = round(revenue_gap_pct / window_multiplier, 2)

        product_health: list[ProductHealth] = []
        for product_name, (actual, plan) in revenue.product_plan.items():
            variance_pct = ((actual - plan) / plan) * 100
            status = "on_track"
            if variance_pct < -8:
                status = "below_plan"
            elif variance_pct < -3:
                status = "at_risk"
            product_health.append(
                ProductHealth(
                    product_name=product_name,
                    actual_value=actual,
                    plan_value=plan,
                    unit="USD",
                    variance_pct=round(variance_pct, 2),
                    status=status,
                )
            )

        below_plan_count = sum(1 for p in product_health if p.status == "below_plan")

        tripped = [
            TripSignal(
                id="revenue-gap",
                label="Revenue proxy",
                triggered=revenue_gap_pct <= -1,
                threshold=">= 1% under plan",
                detail=f"{revenue_gap_pct:.2f}% vs full plan",
            ),
            TripSignal(
                id="products-below-plan",
                label="Products below plan",
                triggered=below_plan_count >= 1,
                threshold=">= 1 product",
                detail=f"{below_plan_count} product(s) below plan",
            ),
        ]

        actions = [
            "Re-open engineering pipeline for recovery workstream.",
            "Promote rollback candidate if crash-free trend degrades for 2 consecutive checks.",
            "Ship onboarding and assistant remediation tasks before next release cut.",
            f"Schedule product + growth review in 24h for {segment} across D{window_days} window.",
        ]

        top_drivers = [
            TopDriver(
                id="onboarding-variance",
                label="Onboarding conversion shortfall",
                impact_pct=-4.2,
                direction="downside",
                detail="Drop in first-session completion from release onboarding funnel.",
            ),
            TopDriver(
                id="assistant-adoption",
                label="Assistant adoption uplift",
                impact_pct=2.6,
                direction="upside",
                detail="Increased repeated usage among engaged cohorts.",
            ),
            TopDriver(
                id="billing-reliability",
                label="Billing reliability drag",
                impact_pct=-3.1,
                direction="downside",
                detail="Error pressure around invoice sync and payment retries.",
            ),
        ]

        now = datetime.now(timezone.utc)
        annotations = [
            ReleaseAnnotation(
                id="deploy-cut",
                timestamp=now,
                label="v2 release deployed to production",
                category="deploy",
            ),
            ReleaseAnnotation(
                id="feature-flag",
                timestamp=now,
                label="Assistant experience expanded to 45% of eligible users",
                category="experiment",
            ),
            ReleaseAnnotation(
                id="incident-001",
                timestamp=now,
                label="Latency spike on search API lasted 27 minutes",
                category="incident",
            ),
        ]

        cards = [
            MetricCard(
                id="retention",
                title="Retention Lift",
                value=_format_pct(metrics.retention_delta_pct),
                delta="Versus prior release cohort",
                status=_status_from_delta(metrics.retention_delta_pct, 10, 0),
                rationale="Core stickiness signal for release product-market confidence.",
            ),
            MetricCard(
                id="dau-mau",
                title="Engagement Depth",
                value=_format_pct(metrics.dau_mau_delta_pct),
                delta="DAU/MAU movement",
                status=_status_from_delta(metrics.dau_mau_delta_pct, 5, 0),
                rationale="Indicates habit strength and sustained return behavior.",
            ),
            MetricCard(
                id="active-users",
                title="Active Reach",
                value=f"{metrics.active_users}",
                delta="7-day active user count",
                status="good" if metrics.active_users >= 100 else "warn",
                rationale="Measures the breadth of adoption during the release window.",
            ),
            MetricCard(
                id="revenue-gap",
                title="Revenue Plan Variance",
                value=f"{revenue_gap_pct:.2f}%",
                delta="Versus modeled release plan",
                status=_status_from_delta(revenue_gap_pct, -1, -4),
                rationale="Early commercial read before month-end finance close.",
            ),
            MetricCard(
                id="crash-free-rate",
                title="Runtime Stability",
                value=f"{metrics.crash_free_rate:.2f}%",
                delta="Crash-free session rate",
                status="good" if metrics.crash_free_rate >= 99 else "warn",
                rationale="Reliability trust indicator for shipped code paths.",
            ),
            MetricCard(
                id="latency",
                title="Interaction Latency (P95)",
                value=f"{metrics.p95_latency_ms} ms",
                delta="API and client response delay",
                status="good" if metrics.p95_latency_ms <= 220 else "warn",
                rationale="Performance drift is a lead indicator of churn risk.",
            ),
            MetricCard(
                id="error-rate",
                title="Error Pressure",
                value=_format_pct(quality["error_rate_delta_pct"]),
                delta="Error-rate change versus baseline",
                status=_status_from_delta(-quality["error_rate_delta_pct"], 0, -6),
                rationale="Production error heat on release-specific pathways.",
            ),
            MetricCard(
                id="ticket-volume",
                title="Support Friction",
                value=_format_pct(metrics.ticket_volume_delta_pct),
                delta="Ticket-volume direction",
                status="good" if metrics.ticket_volume_delta_pct < 0 else "warn",
                rationale="Tracks customer-visible friction introduced by the release.",
            ),
        ]

        headline = (
            f"Release readout: retention {_format_pct(metrics.retention_delta_pct)} · "
            f"DAU/MAU {_format_pct(metrics.dau_mau_delta_pct)} · "
            f"{metrics.active_users} users · modeled revenue gap {revenue_gap_pct:.2f}% vs full plan · "
            f"segment {segment} · D{window_days}"
        )

        generated_at = datetime.now(timezone.utc)
        self.signal_dispatcher.dispatch_regression_if_needed(
            client_id=client_profile.client_id,
            release_context_key=resolved_scope.release_context_key,
            requested_release_id=resolved_scope.requested_release_id,
            environment=environment,
            segment=segment,
            window_days=window_days,
            tripped_signals=tripped,
            generated_at=generated_at,
            webhook_url=client_profile.signal_webhook_url,
            webhook_token=client_profile.signal_webhook_token,
            cooldown_seconds=client_profile.signal_cooldown_seconds,
        )

        return ReleaseReadout(
            client_id=client_profile.client_id,
            client_name=client_profile.client_name,
            release_id=resolved_scope.release_context_key,
            requested_release_id=resolved_scope.requested_release_id,
            source_branch=resolved_scope.branch,
            source_commit_sha=resolved_scope.commit_sha,
            source_commit_short=resolved_scope.commit_short,
            release_context_key=resolved_scope.release_context_key,
            environment=environment,
            segment=segment,
            window_days=window_days,
            generated_at=generated_at,
            headline=headline,
            cards=cards,
            active_users=metrics.active_users,
            retention_delta_pct=metrics.retention_delta_pct,
            dau_mau_delta_pct=metrics.dau_mau_delta_pct,
            revenue_gap_pct=round(revenue_gap_pct, 2),
            products_below_plan_count=below_plan_count,
            tripped_signals=tripped,
            product_health=product_health,
            top_drivers=top_drivers,
            annotations=annotations,
            recommended_actions=actions,
        )
