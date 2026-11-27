# Releasing MoneyMgr to the App Store and Google Play

Builds are made in the cloud with Expo EAS (no Xcode/Android Studio needed) and uploaded with EAS Submit.

## Before the first build (once)

1. **Backend live over HTTPS** — `mgr_backend/infra/aws/README.md`. Note the `api` and `app` addresses it prints.
2. **Set the addresses** in `eas.json` → `build.base.env`:
   ```json
   "EXPO_PUBLIC_API_URL": "https://api.<host>",
   "EXPO_PUBLIC_WEB_URL": "https://app.<host>"
   ```
   A store build with a placeholder or `http://` address stops early (`scripts/check-release-env.js`).
3. **Check the legal pages load**: `https://app.<host>/privacy` and `https://app.<host>/delete-account`.
4. **Accounts**
   - Apple Developer Program ($99/year) — https://developer.apple.com/programs/
   - Google Play Console ($25 once) — https://play.google.com/console — complete identity verification.
   - Expo (free) — `npx eas-cli login`
5. **Link the project to Expo** (adds `extra.eas.projectId` to `app.json`):
   ```bash
   npx eas-cli init
   ```
6. **Demo account for reviewers** (from `mgr_backend`, against the live API):
   ```bash
   pnpm --filter @moneymgr/api demo:user --api https://api.<host> --email review@<something> 
   ```
   It asks for a password. Put the email + password in the review notes (`store/listing.md`).

## Build

```bash
npx eas-cli build --platform all --profile production
```
EAS creates and stores the signing keys the first time (answer "yes" to generating them). Build numbers
increase automatically. For a quick test install on your own phone first: `--profile preview` (Android gives an
`.apk`, iOS needs your device registered: `npx eas-cli device:create`).

## Submit

**iOS**
```bash
npx eas-cli submit --platform ios --latest
```
Then in App Store Connect: fill the listing from `store/listing.md`, screenshots, App Privacy answers, review notes
→ add the build → **Submit for Review**. Review usually takes 1–3 days.

**Android**
1. Create the app in Play Console (name, Free, App), complete *App content*: privacy policy URL, app access (demo
   account), ads (none), content rating, target audience (18+ or 13+), data safety, financial features, account deletion URL.
2. The **first upload must be manual**: download the `.aab` from the EAS build page and upload it to *Testing → Internal testing*.
   After that, `npx eas-cli submit --platform android --latest` uploads to the internal track as a draft.
3. New personal developer accounts must run a **closed test with at least 12 testers for 14 days** before applying for
   production access. Start this as early as possible (friends/family with Android phones, opted in via the test link).
4. Then *Production → Create release*, promote the tested build, and send it for review.

## Every later release

1. Bump `version` in `app.json` for user-visible releases (e.g. `1.0.1`); build numbers bump themselves.
2. `npx eas-cli build --platform all --profile production`
3. `npx eas-cli submit --platform all --latest`, then release in each console.

If the API changed, deploy the backend **first** (older app versions keep working against the new API — never remove
an endpoint the released app still uses).
