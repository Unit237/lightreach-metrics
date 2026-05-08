# Client Onboarding Checklist

Use this for every new client handoff.

## 1) Workspace provisioning

- [ ] Add client profile entry to `backend/config/client_profiles.json`.
- [ ] Add required secrets in deployment environment:
  - [ ] `*_GITHUB_TOKEN`
  - [ ] `*_SIGNAL_WEBHOOK_TOKEN`
- [ ] Confirm `default_client_id` behavior (if needed).

## 2) Integration validation

- [ ] `/api/v1/clients` returns the new client.
- [ ] `/api/v1/release-scope/branches?client_id=<id>` returns branch inventory.
- [ ] Baseline and experiment branch classification matches branch strategy.
- [ ] `/api/v1/release-readout/latest?client_id=<id>&release_id=<branch>` resolves branch + commit.

## 3) Metrics + guardrails calibration

- [ ] Confirm primary metrics are populated from connectors.
- [ ] Validate guardrail thresholds against expected variance range.
- [ ] Enable regression dispatch cooldown for client traffic profile.
- [ ] Fire test regression and verify Signal webhook payload arrival.

## 4) Dashboard QA

- [ ] Client workspace selector shows correct label.
- [ ] Metric strip updates in near real-time.
- [ ] Add/remove metric controls behave correctly.
- [ ] Version diff, drivers, timeline, and product health cards are visually consistent.

## 5) Launch readiness

- [ ] Capture baseline screenshot set for future change detection.
- [ ] Confirm escalation contacts and alert ownership.
- [ ] Share handoff runbook with client operators.
