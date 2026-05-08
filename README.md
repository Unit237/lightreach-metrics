# Lightreach Metrics: Release Readout Tool

This project implements the "What your team and users see after each release" component of The Loop as a production-ready foundation.

## What is included

- React + TypeScript frontend with RASTA-style metric squares
- FastAPI backend for release readout computation
- Trip/alert logic for:
  - revenue proxy under plan
  - product-level underperformance
- Data connector scaffolding for:
  - PostHog (product analytics)
  - Sentry (quality and regressions)
  - Revenue model connector (replace with warehouse source)

## Architecture

- `frontend/`: Dashboard UI and API client
- `backend/`: Readout API, metric models, data source connectors, business logic
- `backend/config/client_profiles.example.json`: Multi-client workspace template
- `docs/CLIENT_PROFILE_SCHEMA.md`: Client configuration schema
- `docs/CLIENT_ONBOARDING_CHECKLIST.md`: Repeatable onboarding checklist
- `docs/CLIENT_HANDOFF_RUNBOOK.md`: Operator handoff runbook

## Multi-client setup

This tool now supports client-specific workspaces with per-client GitHub + alert routing.

1. Copy:

```bash
cp backend/config/client_profiles.example.json backend/config/client_profiles.json
```

2. Fill in each client's repository and branch policy.
3. Export required tokens referenced by `token_env` / `webhook_token_env`.
4. Start backend; frontend will automatically load client workspaces from `/api/v1/clients`.

## Run backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend URL: [http://localhost:8000](http://localhost:8000)

Useful endpoints:

- `/api/v1/clients`
- `/api/v1/release-scope/branches?client_id=<id>`
- `/api/v1/release-readout/latest?client_id=<id>&release_id=<branch>`

## Run frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: [http://localhost:5174](http://localhost:5174)

If your backend is on a different host, set:

```bash
VITE_API_URL=http://localhost:8000
```

## Next integrations to prioritize

For enterprise-grade accuracy, keep PostHog + Sentry and add:

- Warehouse metric layer (BigQuery/Snowflake + dbt Metrics)
- Billing system telemetry (Stripe/Chargebee)
- CRM and pipeline context (HubSpot/Salesforce)
- Feature flag rollout metadata (LaunchDarkly or PostHog feature flags)

This combination lets release diagnostics tie directly to commercial outcomes, not just engagement.
