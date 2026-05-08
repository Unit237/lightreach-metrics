# Client Handoff Runbook

## Goal

Hand over a client-ready release intelligence workspace with clear ownership, alerting, and operating cadence.

## Artifacts to deliver

- Client workspace URL and access instructions
- `client_id` and configured repository details
- Branch strategy summary (baseline + experiment patterns)
- Guardrail definitions and thresholds
- Signal alert destinations and escalation path

## Operator workflow (weekly)

1. Select correct **Client workspace** in sidebar.
2. Confirm current experiment branch and baseline branch.
3. Review Executive Release Scorecard for directional movement.
4. If guardrail pressure is non-zero:
   - inspect Version Diff + Gap Drivers
   - assign corrective actions
   - confirm Signal alert receipt and ownership
5. Record decisions in client changelog.

## Incident workflow (regression trip)

1. Signal webhook receives `release_regression_detected`.
2. On-call engineer reviews tripped signals and branch context.
3. Create remediation branch and patch.
4. Re-run readout against remediation branch vs baseline.
5. Close incident after scorecard returns to acceptable state.

## Ownership matrix

- Product lead: priority and rollout decisions
- Engineering lead: remediation plan + branch hygiene
- Data/analytics: confidence and metric validity
- Account owner: client communication and reporting

## Exit criteria for successful handoff

- Client team can independently run weekly workflow.
- Regression alerts route to agreed on-call channel.
- Branch strategy is documented and followed.
- Baseline/experiment comparisons are stable and interpretable.
