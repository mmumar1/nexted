# Learnpedia Mobile App Conversion Guide

This document records a recommended path for publishing Learnpedia as Android and iOS apps using Capacitor. It is a planning guide for future work; Capacitor has not been added or configured in the project yet.

## Recommendation

Use **Capacitor** to package the existing React and Vite frontend as native Android and iOS applications. This preserves the current web app and backend, avoids a full UI rewrite, and allows native capabilities such as push notifications to be added when they are needed.

Keep the Express and Supabase services hosted as they are today. The apps should call the hosted services over HTTPS; the mobile package must not contain server secrets.

## Current project fit

- The frontend uses React and Vite, making it a suitable candidate for Capacitor's web runtime.
- `npm run build` runs the Vite build and also bundles the Express server. The Vite frontend output is currently `dist/public`; the server bundle is `dist/index.js`.
- The Vite config sets the frontend root to `client` and the output directory to `dist/public`.
- The project already has responsive mobile layouts, but those still need testing and refinement in native webviews.
- There is no Capacitor configuration or native Android/iOS project yet.

When setting `webDir` in Capacitor, use the frontend output (`dist/public`), not the server bundle (`dist/index.js`). Confirm the output path against the Vite configuration when beginning implementation.

## Scope and non-goals for the first release

### First release

- Reuse the current Learnpedia frontend and deployed backend.
- Support login, course access, lessons, videos, quizzes, profile/settings, and the existing student and teacher flows.
- Make the app installable from Google Play and Apple's App Store.
- Add only the native integrations needed for a reliable first release.

### Not included automatically

- A native rewrite of the screens in React Native.
- Offline course downloads or offline quiz attempts.
- Push notifications, calendar synchronization, or background processing.
- Any change to the existing course quiz workflow.

These can be separate follow-up projects after scope and data behavior are agreed.

## Decisions to make before implementation

1. **Payments:** Review the current Apple App Store and Google Play policies for digital learning access and the intended business model. Confirm whether Paystack can remain in the app as currently used, whether store billing is required, or whether another permitted purchase flow applies. Verify the policies at implementation time; they can change.
2. **Minimum supported devices:** Choose minimum iOS and Android versions and define which phones/tablets will be tested.
3. **App identity:** Choose final app name, bundle identifier/package name, store owner accounts, icons, splash art, and support/privacy URLs.
4. **Native features:** Decide whether the first release needs push notifications, deep links, device calendar, file uploads, or biometrics.
5. **Offline behavior:** Decide whether the first release requires any offline learning support. A Capacitor wrapper does not make the web app work offline by itself.
6. **Backend availability:** Confirm the production API and Supabase endpoints use HTTPS and are reachable from the mobile app.

## Implementation plan

### Phase 1: Mobile readiness review

- Test the existing web app at common phone and tablet sizes, including landscape orientation.
- Check keyboard and form behavior, safe areas/notches, scrolling, dialogs, media playback, loading/error states, and touch target sizes.
- Walk through student, teacher, and admin flows on actual devices where possible.
- Test login persistence, logout, password reset, and any email/third-party redirects in a mobile browser and in a native webview.
- Review all browser-dependent features and identify APIs that need native alternatives.

### Phase 2: Configure Capacitor

After choosing the app identifiers and supported platforms:

1. Add Capacitor core and CLI as project dependencies.
2. Create a Capacitor config that uses the frontend build directory (`dist/public`).
3. Add the Android and iOS platform projects.
4. Add repeatable package scripts for building the web frontend, syncing Capacitor assets, and opening the native projects.
5. Add the native project source to version control. Keep signing keys, local environment files, and generated build artifacts out of Git.

Use the official Capacitor setup instructions for the versions current at that time. The commands and required platform tooling may change between Capacitor releases.

### Phase 3: Ensure API and authentication work in the app

- Audit client API calls for assumptions that the app and API share one web origin. In a packaged app, the frontend runs in a local webview origin, so relative `/api/...` requests may not reach the hosted Express server.
- If needed, introduce a single, explicit HTTPS API base URL for production mobile builds. Keep development configuration separate and avoid embedding private keys.
- Confirm the chosen authentication mechanism works in a webview, survives app restarts as intended, and handles logout/expiration safely.
- Keep Supabase authorization and Row Level Security as the security boundary. An anon/public client key is not a substitute for access policies; never package service-role keys or other server secrets.
- Verify redirects and callback URLs for password reset, payment return, and any OAuth/email flows. Add verified app links/universal links only if required.

### Phase 4: Native polish and optional integrations

- Configure status bar, keyboard resizing, safe areas, app icons, splash screens, and Android back-button behavior.
- Check external links and decide which should open in the app versus the system browser.
- Add push notifications only after defining permissions, device-token registration, server delivery, and notification preference behavior.
- Add native plugins only for confirmed product needs; test each plugin on real devices and review its permissions and privacy disclosures.

### Phase 5: Quality assurance and store release

- Test release builds on physical Android and iOS devices, not only browser previews or simulators.
- Exercise slow/offline connections, API failures, expired sessions, app background/foreground transitions, video playback, and payment return flows.
- Test account deletion and privacy/data disclosures according to current store requirements.
- Create store screenshots, descriptions, age/content ratings, support contact, privacy policy, and review notes.
- Set up signing and release processes. iOS distribution requires Apple developer access and macOS with Xcode; Android distribution requires an Android signing configuration and Play Console access.
- Submit to each store and address review feedback before announcing availability.

## Build and release flow to establish

The eventual development/release sequence should be documented in package scripts and CI. Conceptually:

1. Install dependencies.
2. Build the Vite frontend.
3. Sync the generated frontend assets into the Android/iOS projects.
4. Build and test the native app in Android Studio or Xcode.
5. Create signed release artifacts through the platform tools.

Do not load the production website into the app using a remote `server.url` as a shortcut for the store release. The intended packaged app should include the built frontend and connect to the hosted backend. A remote URL can be useful for controlled development workflows, but it changes update, availability, and review behavior.

## Security and configuration checklist

- [ ] No Supabase service-role key, database password, Paystack secret, or other server secret is included in the app bundle.
- [ ] Production service endpoints use HTTPS.
- [ ] Database and API authorization are enforced server-side, including Supabase RLS policies.
- [ ] App links and callback URLs are restricted to expected domains and schemes.
- [ ] Sensitive local files remain ignored by Git; signing credentials are stored securely outside the repository.
- [ ] App permissions are limited to the features actually used and are explained to users.
- [ ] Privacy disclosures match actual data collection, analytics, notifications, and third-party SDK behavior.

## Acceptance checklist

- [ ] Existing web deployment still builds and works after Capacitor setup.
- [ ] Android and iOS release builds install and launch without a network-origin or asset-loading error.
- [ ] Students and teachers can sign in, navigate their allowed areas, and sign out.
- [ ] Course content, video playback, quizzes, and progress updates work on supported devices.
- [ ] Session expiration, password reset, and relevant redirects behave predictably.
- [ ] Payment and purchase behavior has been checked against current store rules and tested end to end.
- [ ] App navigation, keyboard, back behavior, safe areas, and screen rotation are usable.
- [ ] No privileged secret is present in the packaged application.
- [ ] Store listing, privacy materials, signing, and release ownership are ready.

## Rough planning estimate

For the existing React/Vite app, a store-ready Capacitor MVP may take roughly **4–8 weeks**, depending on the amount of mobile-specific polish, payment changes, native integrations, device testing, and store review feedback. This is an early planning range, not a commitment. A React Native rewrite would be a separate, larger effort and is not the recommended first approach.

## Official references

- [Capacitor documentation](https://capacitorjs.com/docs)
- [Capacitor getting started](https://capacitorjs.com/docs/getting-started)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)

Recheck official documentation and store policies when work begins, since supported versions, tooling, and payment requirements may have changed.
