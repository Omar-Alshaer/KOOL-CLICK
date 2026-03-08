# Kool Click - Project Proposal

## 1. Project Title
**Kool Click: University Food Ordering Web Application**

## 2. Executive Summary
Kool Click is a full-stack web platform designed to modernize food ordering inside university campuses. The system allows students to place orders from multiple restaurants, track order progress in real time, and receive their meals using QR-based pickup. In parallel, cashiers and restaurant managers operate through dedicated dashboards that streamline kitchen workflow, payment verification, and delivery handling.

The project focuses on speed, clarity, and scalability for high student traffic (2000+ users), while maintaining a modern pixel-art visual identity tailored to campus youth culture.

## 3. Problem Statement
Traditional on-campus food ordering often suffers from:
- Long waiting lines and crowded cashier points
- Limited visibility on order status
- Manual errors in pickup and payment confirmation
- Weak student loyalty systems
- No centralized analytics for restaurants and administration

Kool Click solves these issues through a unified digital ordering and fulfillment workflow.

## 4. Project Objectives
- Provide a fast, user-friendly ordering experience for students.
- Support multi-restaurant ordering with separate order processing.
- Enable live order tracking from pending to collection.
- Integrate QR-based pickup to reduce mistakes and waiting time.
- Introduce points, levels, and rewards to increase student retention.
- Offer role-based panels for Cashier, Manager, and Admin.
- Ensure scalability, reliability, and secure authentication.

## 5. Scope and Deliverables
### In Scope
- Student registration/login using University ID and password.
- University ID uniqueness validation (8 digits, starts with `2`).
- Avatar selection during account creation.
- Restaurant listing and categorized menus.
- Cart management and checkout.
- Payment methods:
  - Cash on delivery/pickup
  - InstaPay receipt upload (Cloudinary)
- Promo code support.
- QR code generation per order.
- Live order status updates (`Pending -> Preparing -> Ready -> Collected` + cancellation handling).
- Points and level system (`50 EGP = 5 points`).
- Cashier dashboard for operations and order updates.
- Responsive UI (desktop + mobile).

### Out of Scope (Future Expansion)
- Native mobile apps (Android/iOS).
- AI-based recommendation engine.
- Real-time delivery fleet integration outside campus.

## 6. User Roles and Permissions
### Student
- Create account and login.
- Browse restaurants and menu sections.
- Place orders and track status live.
- Upload payment receipt (if InstaPay is selected).
- View QR code for pickup.
- Cancel order (with points penalty policy).
- Rate and review completed orders.

### Cashier
- Access only assigned restaurant orders.
- Open order details and manage progress.
- Scan QR codes for pickup verification.
- Mark orders as collected.
- View completed orders in a separate page.

### Manager
- Manage menu items (create/edit/delete).
- Update item images, prices, and descriptions.
- Configure restaurant-specific offers.
- Access only their own restaurant data.

### Admin
- Manage all users and restaurant entities.
- Monitor system-wide performance.
- Create global promo codes.
- Review analytics (sales, top restaurants, top students).

## 7. System Features
- Multi-page Vanilla architecture (HTML/CSS/JS).
- Pixel-art themed UI with brand palette:
  - `#3B0270`, `#6F00FF`, `#E9B3FB`, `#FFF1F1`
- Popup modal system for success/error/warning feedback.
- Role-isolated navigation and guarded access per module.
- Fast data lookup by using **student University ID as Firestore document ID**.
- Firebase Authentication-backed password security (hashed by Firebase Auth).

## 8. Technology Stack
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES Modules)
- **Backend-as-a-Service:** Firebase
  - Authentication
  - Firestore Database
- **Media Upload:** Cloudinary (receipt upload)
- **QR Handling:** Browser QR generation and scanning integration
- **Hosting:** Firebase Hosting / static hosting-compatible setup

## 9. Data Architecture (High-Level)
Primary collections:
- `users/{universityId}`
- `orders/{orderId}`
- `cashiers/{cashierUid}`
- `restaurants/{restaurantId}`
- `promoCodes/{code}`
- `userAuthIndex/{authUid}`

Key design decisions:
- Student profile access optimized via direct document reads by university ID.
- Orders separated by restaurant for operational clarity.
- Role metadata stored in indexed collections for fast authorization checks.

## 10. Security and Compliance
- Authentication handled by Firebase Auth.
- Passwords are never stored in plain text.
- Role-based page guarding prevents unauthorized panel access.
- Firestore rules enforce least-privilege data access per role.
- Upload handling restricted to approved Cloudinary preset and file constraints.

## 11. UI/UX Strategy
- Pixel-art visual language for a youthful campus identity.
- Consistent components (cards, buttons, modals, chips, status badges).
- Clear hierarchy for critical actions (Checkout, Mark Collected, Cancel).
- Accessible responsive layout for mobile and desktop workflows.

## 12. Performance and Scalability Plan
- Indexed Firestore queries for orders and status filtering.
- Lightweight client rendering and modular JS loading.
- Minimal page payloads with static assets optimization.
- Architecture designed to handle 2000+ active student users.

## 13. Testing and Validation
- Functional testing per user role (Student/Cashier/Manager/Admin).
- Form validation and edge-case tests (duplicate IDs, invalid logins, payment states).
- Responsive testing across common viewport sizes.
- Firestore security-rule validation for role isolation.

## 14. Deployment Plan
1. Configure Firebase project and environment keys.
2. Apply Firestore indexes and security rules.
3. Configure Cloudinary unsigned upload preset for receipts.
4. Deploy static app to hosting.
5. Run post-deployment smoke tests for all user roles.

## 15. Risks and Mitigations
- **Risk:** Query latency under peak load.
  - **Mitigation:** Composite indexes, denormalized read paths, pagination.
- **Risk:** Payment receipt misuse.
  - **Mitigation:** File type/size checks + cashier verification workflow.
- **Risk:** Unauthorized access attempts.
  - **Mitigation:** Strict auth guards + Firestore security rules.

## 16. Success Metrics (KPIs)
- Average order placement time under 2 minutes.
- Reduction in pickup queue congestion.
- Increase in repeat student orders via points/levels.
- High cashier completion throughput during peak hours.

## 17. Conclusion
Kool Click delivers a practical, scalable, and engaging digital ecosystem for university food ordering. By combining role-based operations, live tracking, QR pickup, and a loyalty system, the platform improves both student experience and restaurant efficiency inside campus.

---

## Repository Structure
- `index.html`
- `public/pages/student/`
- `public/pages/cashier/`
- `public/js/config/`
- `public/js/services/`
- `public/js/utils/`
- `public/js/data/`
- `public/css/theme.css`
