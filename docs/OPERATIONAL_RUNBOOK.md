# Kool Click Operational Runbook

## System Health Model

Track the platform with four primary health signals:

- `ACTIVE_ORDERS_RATE`: count of newly created orders and collected orders per time window.
- `DASHBOARD_LOAD_RATE`: dashboard/report fetch frequency and active operational sessions.
- `FUNCTION_ERROR_RATE`: callable failures divided by total callable executions.
- `FIRESTORE_READ_COST_RATE`: estimated read units produced by operational dashboards, reports, and admin views.

## Operational Metrics Collections

Server-side functions may write:

- `opsMetrics/{yyyy-mm-dd}`: daily aggregate counters for function calls, failures, latency totals, cold starts, idempotency hits, and abuse flags.
- `systemHealth/current`: last observed function status and latency.
- `adminRateLimits/{adminUid_action_bucket}`: short-lived admin governance rate limit counters.

Clients must never write these collections directly.

## Cost Control Strategy

Top expected cost drivers:

- Manager live order dashboard: realtime reads scale with active order updates per restaurant.
- Cashier active queue polling: read cost scales with cashier sessions and refresh cadence.
- Historical reports/completed orders: bounded with pagination or explicit one-shot fetches.

Per 100 active operational users, the highest risk is duplicated active dashboard sessions across cashier and manager screens. Keep realtime reads only for live queues and keep historical/report data paginated.

## Admin Governance

High-risk admin actions require recent authentication and server-side rate limits:

- User creation: limited per minute.
- Role updates: limited per minute.
- User deletion: limited per hour.

Bulk delete, system-wide reset, and superAdmin self-management must remain unavailable unless a separate signed operational procedure is approved.

## Abuse Detection

Log and monitor:

- `resource-exhausted` callable failures.
- Order idempotency replay spikes.
- Admin rate limit hits.
- Repeated failed promo/order attempts.
- Unexpected Cloudinary upload failure spikes.

Escalate to the system owner when abnormal spikes persist for more than one monitoring window.

## Data Lifecycle Strategy

- Active order queries should focus on pending/preparing/ready/recent collected orders.
- Historical orders should move to paginated access and later archival.
- Audit logs should be retained long enough for operational accountability.
- Debug-level operational metrics can be retained for a shorter period than audit logs.
- No automatic deletion should run until retention requirements are formally approved.

## Incident Response

If Firestore read cost spikes:

- Disable non-critical report refreshes.
- Reduce dashboard polling intervals.
- Confirm no duplicate listeners are leaking.
- Check `opsMetrics` and Cloud Logging for top callable paths.

If Cloud Functions fail:

- Verify latest deployment and environment.
- Roll back the last function deployment.
- Keep Firestore rules strict; do not reopen client writes as a workaround.

If admin abuse is suspected:

- Disable the affected Firebase Auth user.
- Review `auditLogs`.
- Review `adminRateLimits`.
- Rotate affected credentials.

## Emergency Switches

Prefer server-side feature flags for future emergency controls:

- `systemConfig/checkout.enabled`
- `systemConfig/adminWrites.enabled`
- `systemConfig/reports.enabled`

Feature flags must be read server-side for sensitive operations.
