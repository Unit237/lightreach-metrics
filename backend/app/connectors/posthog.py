import os
import random

from .base import MetricsSnapshot


class PostHogConnector:
    """
    Placeholder connector. Replace generated numbers with real PostHog queries.
    """

    def __init__(self) -> None:
        self.api_key = os.getenv("POSTHOG_API_KEY", "")
        self.project_id = os.getenv("POSTHOG_PROJECT_ID", "")

    def fetch_product_metrics(self, release_id: str) -> MetricsSnapshot:
        seed = sum(ord(c) for c in release_id)
        random.seed(seed)
        return MetricsSnapshot(
            retention_delta_pct=round(56 + random.random() * 8, 2),
            dau_mau_delta_pct=round(18 + random.random() * 9, 2),
            active_users=120 + random.randint(0, 35),
            crash_free_rate=round(98.4 + random.random() * 1.2, 2),
            p95_latency_ms=190 + random.randint(-25, 45),
            ticket_volume_delta_pct=round(-12 + random.random() * 6, 2),
        )
