# Client Profile Schema

This dashboard supports client-specific delivery via `backend/config/client_profiles.json`.

## Shape

```json
{
  "default_client_id": "acme",
  "clients": [
    {
      "client_id": "acme",
      "client_name": "Acme Corp",
      "github": {
        "owner": "acme-inc",
        "repo": "acme-product",
        "token_env": "ACME_GITHUB_TOKEN"
      },
      "branch_policy": {
        "baseline_patterns": ["main", "release/*"],
        "experiment_patterns": ["dev/*", "exp/*", "feature/*"]
      },
      "signal_routing": {
        "webhook_url": "https://signal.lightreach.io/hooks/regressions/acme",
        "webhook_token_env": "ACME_SIGNAL_WEBHOOK_TOKEN",
        "cooldown_seconds": 300
      }
    }
  ]
}
```

## Field reference

- `default_client_id`: fallback workspace when a request does not specify `client_id`.
- `clients[]`:
  - `client_id`: stable key used by API and frontend.
  - `client_name`: display label in the UI.
  - `github.owner` / `github.repo`: repository used for branch discovery.
  - `github.token` or `github.token_env`: GitHub token (prefer env var reference).
  - `branch_policy.baseline_patterns`: fnmatch patterns for baseline branch classification.
  - `branch_policy.experiment_patterns`: fnmatch patterns for experiment branch classification.
  - `signal_routing.webhook_url`: destination for regression alerts.
  - `signal_routing.webhook_token` or `signal_routing.webhook_token_env`: auth token for the webhook.
  - `signal_routing.cooldown_seconds`: dedupe interval for repeat alerts.

## Runtime behavior

- API routes now accept optional `client_id`.
- If omitted, backend resolves to `default_client_id`.
- Unknown `client_id` returns `404`.
- If config file is missing, the app falls back to legacy single-workspace env vars.
