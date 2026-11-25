# MoneyMgr — mobile (Expo / React Native)

iOS + Android app for the MoneyMgr API (`../mgr_backend`). Expo SDK 58, Expo Router, TanStack Query, and a typed client generated from the API's OpenAPI spec.

## Run
```bash
npm install
cp .env.example .env          # EXPO_PUBLIC_API_URL (see below)
npm start                     # Expo dev server; press i / a / w, or scan the QR code with Expo Go
npm test                      # Jest (jest-expo + Testing Library): 101 tests
npm run typecheck
```
The backend must be running (`pnpm dev` in `mgr_backend`, port 8000).

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| iOS simulator, web | `http://localhost:8000` (default) |
| Android emulator | `http://10.0.2.2:8000` (default on Android) |
| Real phone | `http://<your computer's LAN IP>:8000` (same Wi-Fi) |

Tokens are kept in the Keychain / Keystore via `expo-secure-store` (on web, which is a development convenience only, in `localStorage`).

## Layout
- `src/app` — Expo Router routes: `(auth)` login/register/forgot-password, `(app)/(tabs)` Home · Activity · Budgets · Invest · More, modals for transactions (tags + receipt photos), budgets, transfers, recurring rules, assets, trades, goals (+ add/take out money), debts (+ repayments) and notes, plus Goals, Debts, Notes, Reports, Accounts, Categories & tags, Transfers, Recurring, asset detail, SIP calculator and Settings (appearance, change password, delete account). `reset-password` and `verify-email` sit outside both groups so email links open signed in or out (`moneymgr://reset-password?token=…`; the reset screen also accepts the pasted link). A session guard in `_layout.tsx` (`Stack.Protected`) decides which group is reachable.
- `src/api` — `client.ts` (typed openapi-fetch client, bearer auth, refresh-before-expiry, single-flight rotation-safe refresh, retry on 401), `session.ts` (secure token store), `hooks.ts` (queries), `schema.d.ts` (generated).
- `src/components`, `src/theme`, `src/lib/money.ts` — UI kit, tokens shared with the web app (navy dark / lavender light, System·Light·Dark remembered on the device), Intl-free money formatting.
- Motion & feedback: `FadeIn` (staggered fade-up), pulsing `Skeleton`/`ListSkeleton`/`CardsSkeleton`, animated `ProgressBar`, press-scale buttons with spinners, bar charts that rise and a share bar that sweeps (`components/charts.tsx`, plain Views — no SVG dependency), totals that count up (`lib/use-count-up.ts`), and toasts for every save/delete (`lib/toast.ts` + `ToastHost`, raised from the QueryClient's `MutationCache`). All of it is skipped when the OS asks for reduced motion (`lib/motion.ts`).

## API types
```bash
npm run api:sync      # copies ../mgr_backend/apps/api/openapi.json and regenerates src/api/schema.d.ts
```

## Not built yet
Importing v1 investment JSON (web app only), push notifications, biometric lock, offline mode, store assets. See `../mgr_frontEnd/PLAN.md`.

## Notes
- React Compiler is **off** (`app.json` → `experiments.reactCompiler`): with it on, an optional-chaining initial state value crashed the transaction form.
- Reanimated's Babel plugin rewrites any `something.value` read inside a `style={{…}}` object (it assumes a shared value) and crashes outside the native runtime — destructure it to another name first (see `ShareBar`).
- Verified natively on the iOS simulator (Expo Go, iPhone 18 Pro) on 2026-11-25: sign-up/in, dashboard charts, Activity + tags, edit form, receipt from the photo library (uploads and the authenticated thumbnail loads), toasts, light and dark. Also verified on the Android emulator (Expo Go, API 37 "Medium Phone") the same day: sign-in, dashboard charts, Activity + tags, receipt from the system photo picker (uploaded, thumbnail loads), Goals, Reports, light and dark. On the emulator run `adb reverse tcp:8000 tcp:8000` so `localhost:8000` from `.env` reaches the API on the Mac (or set `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`).
- Receipts on native go into FormData as an `expo-file-system` `File`: Expo's fetch rejects the classic `{ uri, name, type }` part with "Unsupported FormDataPart implementation".
- Import & export (More → Import & export): pick an .xls/.xlsx/.csv (expo-document-picker), parsed on the phone with the same rules as the web (`src/lib/import.ts`), check then import; CSV export goes to the share sheet (expo-sharing). On Android the picker's `content://` link is read directly — in Expo Go the cached copy is outside the folders the app may read ("Missing READ permission").
- PDF receipts: iOS shows them in an in-app WebView (sent with the bearer token); Android downloads to the cache and opens the phone's PDF viewer (Android's WebView can't render PDFs). Receipts can also come from Files.
- Exchange rate field (`src/components/fx-field.tsx`): shows the stored rate used when left empty (`GET /fx`), previews the converted amount, and offers the last rate typed for that pair on this device.
- Toasts render through `FullWindowOverlay` on iOS; otherwise they sit underneath native modal screens and errors there are invisible.
