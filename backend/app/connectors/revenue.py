import random

from .base import RevenueSnapshot


class RevenueModelConnector:
    """
    Replace with real warehouse/BI integration (e.g. BigQuery, Snowflake, dbt metrics).
    """

    def fetch_revenue_metrics(self, release_id: str) -> RevenueSnapshot:
        seed = sum(ord(c) for c in f"revenue-{release_id}")
        random.seed(seed)

        planned_revenue = 125_000.0
        gap_pct = 10 + random.random() * 6
        modeled_revenue = planned_revenue * (1 - gap_pct / 100)

        product_plan = {
            "Onboarding": (13_600, 15_000),
            "Messaging": (11_200, 13_000),
            "Billing": (22_300, 24_000),
            "Assistant": (28_100, 32_000),
            "Search": (15_900, 18_000),
            "Analytics": (20_700, 23_000),
        }

        return RevenueSnapshot(
            modeled_revenue=round(modeled_revenue, 2),
            planned_revenue=planned_revenue,
            product_plan=product_plan,
        )
