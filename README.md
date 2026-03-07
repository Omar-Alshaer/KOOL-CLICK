# Kool Click (Vanilla Student Module)

Student-only multi-page web app scaffold for Kool Click using HTML/CSS/JS with Firebase Auth + Firestore.

## Implemented Now

- Student registration with:
  - Full name, university ID, phone, birth date, password
  - Avatar selection from `public/assets/Characters`
  - University ID validation: must be 8 digits and start with `2`
  - No duplicate university ID (reserved in Firestore)
- Student login using university ID + password
- Student-only pages:
  - `login.html`
  - `register.html`
  - `home.html`
  - `menu.html`
  - `cart.html`
  - `orders.html`
  - `profile.html`
- Multi-restaurant cart confirmation, and split into separate orders automatically
- Order statuses flow: `Pending -> Preparing -> Ready -> Collected`
- Points and levels system:
  - Every 50 EGP => 5 points
  - Levels + discounts configurable in `public/js/config/app-config.js`
- Pixel-art inspired UI with your brand colors:
  - `#3B0270`, `#6F00FF`, `#E9B3FB`, `#FFF1F1`

## Project Structure

- `index.html` (redirect to student login)
- `public/css/theme.css`
- `public/js/config/`
- `public/js/services/`
- `public/js/utils/`
- `public/js/data/`
- `public/pages/student/`

## Firebase Setup

1. Create Firebase project.
2. Enable Authentication -> Email/Password.
3. In `public/js/config/firebase.js`, fill:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
4. Create Firestore database.

## Firestore Collections Used

- `users/{universityId}`
  - `role: "student"`
  - `authUid`
  - `universityId`, `fullName`, `phone`, `birthDate`, `avatar`
  - `points`, `level`
- `universityIds/{universityId}`
  - reserve IDs to prevent duplicates
- `userAuthIndex/{authUid}`
  - maps Firebase Auth UID -> universityId for fast profile lookup
- `orders/{orderId}`
  - student data, restaurant, items, status, pointsEarned, payment fields
  - `qrPayload` set to `orderId`
- `cashiers/{authUid}`
  - cashier profile (`displayName`, `restaurantId`, `restaurantName`)

## Notes

- Student pages are isolated from admin/manager/cashier pages.
- Cloudinary is reserved for receipt upload in next phase (not wired yet).
- Avatars are loaded from `public/assets/Characters/avatars.json`.
- If you add or remove avatars in `public/assets/Characters`, update `avatars.json` accordingly.
- For local run, serve via any static server (not `file://`) to allow ES modules.
- Passwords are handled by Firebase Auth only (hashed securely by Firebase) and are never stored in Firestore.
- Cashier login requires:
  - Firebase Auth user with synthetic email from phone:
  - `<phone>@cashiers.koolclick.app`
  - cashier signs in on UI using `phone + password`
  - `userAuthIndex/{authUid}` with `{ role: \"cashier\", restaurantId }`
  - `cashiers/{authUid}` with `{ displayName, restaurantId, restaurantName }`
