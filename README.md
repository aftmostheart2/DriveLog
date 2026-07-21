# DriveLog

DriveLog is a mobile-first vehicle maintenance app prototype. It is designed as
a polished UI mockup today, with a code shape that can later grow into a real
iPhone app for TestFlight and App Store distribution.

## What Is Included

- Home dashboard with fleet overview, selected vehicle, spend, cost per mile,
  quick actions, and recent service.
- Garage and vehicle profiles with VIN, plate, mileage, notes, photos, parts,
  reminders, and history.
- Maintenance history with search and service logging.
- Analytics for total cost, average service cost, spending over time, category
  split, and expensive repairs.
- Purchased parts inventory with installation status and project links.
- Future projects with statuses, priority, cost tracking, checklists, detail
  sheets, and project-to-maintenance conversion.
- Wishlist with retailer comparison and move-to-purchased-parts flow.
- Maintenance reminders.
- Settings and JSON backup export.

## Current Prototype Storage

The UI uses a small repository boundary in `app/page.tsx` instead of scattering
storage calls through the components. For now it persists demo changes in
browser storage so the prototype stays simple and offline.

For a production iOS app, replace that boundary with:

- IndexedDB for the web/PWA version.
- SQLite for a native iOS wrapper.
- Cloud sync and object storage for account backup, photos, and receipts.

The interface should continue to call high-level storage functions rather than
reading directly from a database in page components.

## Run Locally

Install dependencies and start the local server:

```bash
npm install
npm run dev
```

Build before pushing or deploying:

```bash
npm run build
```

This workspace may also run with `pnpm` if that is your preferred package
manager.

## GitHub

Create a GitHub repository, then push:

```bash
git init
git add .
git commit -m "Build DriveLog prototype"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/DriveLog.git
git push -u origin main
```

## Future TestFlight Path

There are three reasonable ways to turn this into an iPhone app:

1. React Native with Expo: best if you want a real native-feeling app and are
   comfortable rebuilding the UI in React Native components.
2. Capacitor: best if you want to wrap the web app and reuse most of the UI.
3. SwiftUI: best long-term native quality, but the most rewrite work.

If you choose Capacitor later, the rough flow is:

```bash
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init
npx cap add ios
npx cap sync ios
npx cap open ios
```

Then use Xcode to set the bundle identifier, signing team, icons, launch screen,
version, and build number. Archive the app and upload it to App Store Connect
for TestFlight.

## Production Notes

Before using DriveLog for real records, add:

- Account login.
- Cloud backup and restore.
- Receipt/photo upload storage.
- Import/export recovery.
- Sync conflict handling.
- Privacy policy.
- Manufacturer-maintenance disclaimer.

