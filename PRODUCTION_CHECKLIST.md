# Kool Click Production Readiness Checklist

## Security

- Deploy `firestore.rules` and verify every role flow in Firebase Emulator or staging.
- Move loyalty point mutations and final order creation to a trusted backend before handling real money at scale.
- Restrict the Cloudinary unsigned upload preset by folder, MIME type, max size, and upload source.
- Add Firebase authorized domains for every production and preview domain.
- Review Firestore rules after any collection shape change.
- Bootstrap the first `superAdmin` manually in Firebase Auth and `users/{uid}`; never expose a public self-promotion endpoint.
- Confirm only Cloud Functions can write `users`, `userAuthIndex`, `auditLogs`, and `deletedUsers`.
- Confirm only Cloud Functions can write `opsMetrics`, `systemHealth`, and `adminRateLimits`.
- Confirm high-risk admin actions require a recent authentication token.

## Data Integrity

- Keep product prices, offer discounts, and promo codes as the source of truth in Firestore.
- Do not trust `localStorage` cart prices for totals or points.
- Keep Firestore indexes deployed from `firestore.indexes.json`.
- Monitor failed order writes after rules deployment.

## Performance

- Add pagination for dashboards and reports before peak launch.
- Avoid broad realtime listeners for historical reports.
- Use lazy loading for non-critical product, offer, and receipt images.
- Add cache headers for static assets on the active hosting platform.

## Deployment

- Vercel can continue serving the static app with `vercel.json`.
- Firebase Hosting can serve the same static app with `firebase.json`.
- Deploy Firestore rules and indexes separately from static hosting when possible.
- Open the system owner panel from `/pages/admin/login.html` only after the first `superAdmin` profile exists.
- Smoke test Clicker, Cashier, and Manager flows after every deploy.

## Operations

- Create test accounts for each role in staging.
- Verify Cloudinary upload failures produce clear user-facing errors.
- Track Firebase Auth, Firestore reads/writes, and Cloudinary upload usage.
- Keep a rollback plan for Firestore rules changes.
- Monitor Cloud Functions logs for `createClickerOrders`, `cancelClickerOrder`, and `collectOrderByCashier` failures.
- Monitor Cloud Functions logs for `adminCreateUser`, `adminUpdateUserRole`, and `adminDeleteUser` failures.
- Review `opsMetrics/{yyyy-mm-dd}` and `systemHealth/current` during production checks.
- Alert on repeated `adminRateLimits` hits because they may indicate account compromise or unsafe automation.
- Alert on spikes in `resource-exhausted` callable errors because they may indicate order spam or broken retry behavior.
- Never log phone numbers, receipt URLs, raw cart payloads, or full user profile data.
