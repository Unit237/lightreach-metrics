from __future__ import annotations

from datetime import datetime, timezone
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.models import TripSignal


class SignalDispatcher:
    def __init__(self) -> None:
        self.webhook_url = os.getenv("SIGNAL_PRODUCT_WEBHOOK_URL", "").strip()
        self.webhook_token = os.getenv("SIGNAL_WEBHOOK_TOKEN", "").strip()
        self.cooldown_seconds = int(os.getenv("SIGNAL_ALERT_COOLDOWN_SECONDS", "600"))
        self._last_sent_by_key: dict[str, float] = {}

    def dispatch_regression_if_needed(
        self,
        client_id: str,
        release_context_key: str,
        requested_release_id: str,
        environment: str,
        segment: str,
        window_days: int,
        tripped_signals: list[TripSignal],
        generated_at: datetime,
        webhook_url: str | None = None,
        webhook_token: str | None = None,
        cooldown_seconds: int | None = None,
    ) -> bool:
        resolved_webhook_url = (webhook_url or self.webhook_url or "").strip()
        resolved_webhook_token = (webhook_token or self.webhook_token or "").strip()
        resolved_cooldown = self.cooldown_seconds if cooldown_seconds is None else max(0, cooldown_seconds)
        if not resolved_webhook_url:
            return False

        triggered = [signal for signal in tripped_signals if signal.triggered]
        if not triggered:
            return False

        cooldown_key = f"{client_id}:{release_context_key}:{environment}:{segment}:{window_days}"
        now = time.time()
        last_sent = self._last_sent_by_key.get(cooldown_key, 0)
        if now - last_sent < resolved_cooldown:
            return False

        payload = {
            "event_type": "release_regression_detected",
            "generated_at": generated_at.astimezone(timezone.utc).isoformat(),
            "release_context_key": release_context_key,
            "requested_release_id": requested_release_id,
            "environment": environment,
            "segment": segment,
            "window_days": window_days,
            "triggered_signals": [
                {
                    "id": signal.id,
                    "label": signal.label,
                    "threshold": signal.threshold,
                    "detail": signal.detail,
                }
                for signal in triggered
            ],
        }

        sent = self._post_payload(payload, webhook_url=resolved_webhook_url, webhook_token=resolved_webhook_token)
        if sent:
            self._last_sent_by_key[cooldown_key] = now
        return sent

    def _post_payload(self, payload: dict, webhook_url: str, webhook_token: str) -> bool:
        body = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if webhook_token:
            headers["Authorization"] = f"Bearer {webhook_token}"
        request = Request(webhook_url, data=body, method="POST", headers=headers)
        try:
            with urlopen(request, timeout=4) as response:
                return 200 <= response.status < 300
        except (HTTPError, URLError, TimeoutError):
            return False
