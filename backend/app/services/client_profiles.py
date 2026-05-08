from __future__ import annotations

from dataclasses import dataclass
import json
import os
from pathlib import Path

DEFAULT_BASELINE_PATTERNS = ["main", "master", "trunk", "production", "release", "release/*"]
DEFAULT_EXPERIMENT_PATTERNS = ["dev/*", "develop", "exp/*", "experiment/*", "feature/*"]


@dataclass(frozen=True)
class ClientProfile:
    client_id: str
    client_name: str
    github_owner: str | None
    github_repo: str | None
    github_token: str | None
    baseline_patterns: list[str]
    experiment_patterns: list[str]
    signal_webhook_url: str | None
    signal_webhook_token: str | None
    signal_cooldown_seconds: int


class ClientProfileStore:
    def __init__(self, config_path: Path | None = None) -> None:
        default_path = Path(__file__).resolve().parents[2] / "config" / "client_profiles.json"
        self.config_path = config_path or Path(os.getenv("CLIENT_PROFILES_PATH", str(default_path)))
        self.default_client_id = os.getenv("DEFAULT_CLIENT_ID", "default")
        self._profiles = self._load_profiles()

    def list_profiles(self) -> list[ClientProfile]:
        return list(self._profiles.values())

    def get_client_profile(self, client_id: str | None = None) -> ClientProfile:
        requested = (client_id or self.default_client_id).strip()
        if requested in self._profiles:
            return self._profiles[requested]
        if client_id:
            raise KeyError(f"Unknown client_id '{client_id}'")
        return next(iter(self._profiles.values()))

    def _load_profiles(self) -> dict[str, ClientProfile]:
        profiles = self._load_profiles_from_file()
        if profiles:
            return profiles
        fallback = self._build_env_default_profile()
        return {fallback.client_id: fallback}

    def _load_profiles_from_file(self) -> dict[str, ClientProfile]:
        if not self.config_path.exists():
            return {}
        try:
            payload = json.loads(self.config_path.read_text())
        except json.JSONDecodeError:
            return {}
        raw_clients = payload.get("clients", [])
        if not isinstance(raw_clients, list):
            return {}
        profiles: dict[str, ClientProfile] = {}
        for item in raw_clients:
            if not isinstance(item, dict):
                continue
            client = self._parse_profile_item(item)
            if client:
                profiles[client.client_id] = client
        default_from_file = str(payload.get("default_client_id", "")).strip()
        if default_from_file:
            self.default_client_id = default_from_file
        return profiles

    def _parse_profile_item(self, item: dict) -> ClientProfile | None:
        client_id = str(item.get("client_id", "")).strip()
        client_name = str(item.get("client_name", "")).strip()
        if not client_id or not client_name:
            return None
        github = item.get("github", {})
        github_owner = self._optional_str(github, "owner")
        github_repo = self._optional_str(github, "repo")
        github_token = self._resolve_secret(github, "token", "token_env")
        branch_policy = item.get("branch_policy", {})
        baseline_patterns = self._list_or_default(
            branch_policy.get("baseline_patterns"), DEFAULT_BASELINE_PATTERNS
        )
        experiment_patterns = self._list_or_default(
            branch_policy.get("experiment_patterns"), DEFAULT_EXPERIMENT_PATTERNS
        )
        signal = item.get("signal_routing", {})
        signal_webhook_url = self._optional_str(signal, "webhook_url")
        signal_webhook_token = self._resolve_secret(signal, "webhook_token", "webhook_token_env")
        cooldown = int(signal.get("cooldown_seconds", 600))
        return ClientProfile(
            client_id=client_id,
            client_name=client_name,
            github_owner=github_owner,
            github_repo=github_repo,
            github_token=github_token,
            baseline_patterns=baseline_patterns,
            experiment_patterns=experiment_patterns,
            signal_webhook_url=signal_webhook_url,
            signal_webhook_token=signal_webhook_token,
            signal_cooldown_seconds=max(0, cooldown),
        )

    def _build_env_default_profile(self) -> ClientProfile:
        return ClientProfile(
            client_id="default",
            client_name=os.getenv("DEFAULT_CLIENT_NAME", "Default Workspace"),
            github_owner=self._env_optional("GITHUB_OWNER"),
            github_repo=self._env_optional("GITHUB_REPO"),
            github_token=self._env_optional("GITHUB_TOKEN"),
            baseline_patterns=DEFAULT_BASELINE_PATTERNS,
            experiment_patterns=DEFAULT_EXPERIMENT_PATTERNS,
            signal_webhook_url=self._env_optional("SIGNAL_PRODUCT_WEBHOOK_URL"),
            signal_webhook_token=self._env_optional("SIGNAL_WEBHOOK_TOKEN"),
            signal_cooldown_seconds=int(os.getenv("SIGNAL_ALERT_COOLDOWN_SECONDS", "600")),
        )

    def _resolve_secret(self, section: dict, key: str, env_key: str) -> str | None:
        inline = self._optional_str(section, key)
        if inline:
            return inline
        env_name = self._optional_str(section, env_key)
        if env_name:
            return self._env_optional(env_name)
        return None

    def _list_or_default(self, value: object, default: list[str]) -> list[str]:
        if isinstance(value, list):
            normalized = [str(item).strip() for item in value if str(item).strip()]
            if normalized:
                return normalized
        return default

    def _optional_str(self, section: dict, key: str) -> str | None:
        value = section.get(key, "")
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    def _env_optional(self, key: str) -> str | None:
        value = os.getenv(key, "").strip()
        return value or None
