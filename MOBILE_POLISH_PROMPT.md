# GameCase Mobile — Polish & Pre-Launch Prompt

Use this prompt verbatim to resume polishing the mobile app before any deployment work begins.

---

## Context

You are working on a React Native / Expo (SDK 54, New Architecture) mobile app that is part of a
monorepo. The stack is:

- **Routing:** Expo Router v6 (file-system)
- **State:** Zustand (`src/store/auth.store.ts`)
- **Server state:** TanStack React Query v5
- **Styling:** NativeWind v4 (Tailwind utility classes)
- **API:** Axios client with auto-refresh interceptor (`src/api/client.ts`)
- **Forms:** react-hook-form + zod
- **Backend:** Node/Express at `packages/backend`, shared types in `packages/shared`

The app skeleton is **fully functional in Expo Go**. Every screen exists and connects to the real
backend. The goal of this session is to close all known gaps, fix rough edges, and bring the app to
a "user-ready" quality level before attempting an EAS build or store submission.

All work is limited to `packages/mobile/` unless a backend route genuinely needs to be added.

---

## Known Gaps — Implement All of These

### 1. Forgot Password flow  (HIGH)
- Add a "Forgot password?" link to `app/(auth)/login.tsx` (below the password field).
- Create `app/(auth)/forgot-password.tsx`: email input → calls `POST /auth/forgot-password` → shows
  a "Check your email" confirmation screen.
- Create `app/(auth)/reset-password.tsx`: reads `?token=` from the deep-link, displays new-password
  + confirm fields, calls `POST /auth/reset-password`, then redirects to login.
- Register both screens in `app/_layout.tsx` (`Stack.Screen`).
- Verify the backend routes exist; add them if they are missing.

### 2. Library rename (MEDIUM)
- `app/(tabs)/library.tsx` currently shows an Alert: _"Rename coming soon — use the web app"_.
- Replace it with a proper in-place rename modal (single `TextInput`, current name pre-filled,
  calls `PATCH /libraries/:id`, invalidates `queryKeys.libraries.all`).

### 3. User data on cold start (HIGH)
- `src/store/auth.store.ts` `loadFromStorage` only restores tokens; `user` stays `null` until the
  Profile tab fires its `getMe` query.
- After tokens are restored successfully, immediately call `GET /auth/me` and populate `user` in the
  store so every tab has access to `user.plan`, `user.username`, etc. from the moment the app opens.

### 4. Friend-request direction on public profile (MEDIUM)
- `app/user/[username].tsx` `FriendButtonRow`: when status is `"pending"` it always shows
  **"Request Sent"**, but it could be an *incoming* request.
- The backend `/friends/status/:userId` response should include a `direction` field
  (`"sent" | "received"`). Add that field (backend + shared type) and update the button:
  - `direction === "received"` → show Accept / Decline buttons.
  - `direction === "sent"` → show "Request Sent".

### 5. App icon & splash screen (HIGH)
- `app.config.ts` has `icon: undefined` and no splash config — this crashes EAS builds.
- Add a placeholder 1024×1024 PNG at `assets/icon.png` and a 2048×2048 splash at
  `assets/splash.png` (solid `#0f172a` background with a centered violet game-controller icon is
  fine for now).
- Update `app.config.ts`: set `icon`, `splash` (with `backgroundColor: "#0f172a"`), and
  `android.adaptiveIcon.foregroundImage`.

### 6. EAS project ID (HIGH — needed before any build)
- `app.config.ts` has `eas.projectId: undefined`.
- Run `eas init` (or set the value manually once an EAS project exists). Document the step in
  `DEPLOYMENT.md`.

### 7. Upgrade screen pricing (MEDIUM)
- `app/billing/upgrade.tsx` shows "Pro Plan · Billed monthly" but no price.
- Call `GET /billing/price` (add the endpoint if missing — it should read the Stripe price amount
  and currency and return them) and display the formatted price, e.g. **$4.99 / month**.

### 8. Network error states (MEDIUM)
- `app/(tabs)/games.tsx` shows "No games found" for both empty results and network errors.
- When `isError === true`, show a distinct error card ("Couldn't load games — tap to retry") with a
  retry button that calls `refetch()`.
- Apply the same pattern to `app/(tabs)/library.tsx` and `app/(tabs)/friends.tsx`.

### 9. Notifications placeholder (LOW — mark clearly)
- The Notifications quick-link in `app/(tabs)/profile.tsx` fires an Alert "Coming soon".
- Replace the Alert with a dedicated stub screen `app/notifications.tsx` that displays an
  `EmptyState` with icon `"notifications-outline"`, title "Notifications", subtitle "Push
  notifications are coming soon." Register it in `_layout.tsx`.
- This makes the routing clean so push notifications can be wired in later without structural
  changes.

### 10. Show password toggle on login & register (MEDIUM)
- Both `app/(auth)/login.tsx` and `app/(auth)/register.tsx` use `secureTextEntry` with no reveal
  button.
- Add an eye / eye-off `Ionicons` icon toggle inside the password field.

### 11. Activity feed header label inconsistency (LOW)
- The tab bar label is **"Feed"** but the screen header says **"Activity"**.
- Align them — either change the tab label to "Activity" or the header to "Feed".

### 12. Empty state for non-Pro Steam page (LOW)
- `app/steam.tsx` skips all queries when `!isPro`, but the non-Pro path shows nothing useful.
- Add an explicit gate at the top of the screen: if `!isPro`, render an `EmptyState` with a
  "Requires Pro" message and an "Upgrade" button linking to `/billing/upgrade`.

### 13. Google OAuth proxy hardcoded Expo username (MEDIUM)
- `app/(auth)/login.tsx` has:
  ```ts
  const proxyRedirectUri = 'https://auth.expo.io/@jjosephsen/gamecase';
  ```
- Move this to `EXPO_PUBLIC_GOOGLE_REDIRECT_URI` in `.env` / `app.config.ts` `extra` so it can be
  changed per-environment without a code change.

### 14. Pull-to-refresh on Friends tab (LOW)
- The `FriendsView` inside `app/(tabs)/friends.tsx` has a `RefreshControl` but the `RequestsView`
  and `FindView` do not.
- Add pull-to-refresh to `RequestsView` (invalidates `pending` + `sent` queries).

### 15. Haptic feedback on primary actions (LOW)
- Install `expo-haptics` (already available in Expo SDK 54).
- Add `Haptics.impactAsync(ImpactFeedbackStyle.Light)` to:
  - "Add to Library" confirm in `game/[slug].tsx`
  - "Create Library" success in `library/new.tsx`
  - Friend request sent / accepted in `friends.tsx`

---

## Non-Functional / Config Tasks

| Task | File | Action |
|---|---|---|
| Remove unused `tsc_out.txt` | `packages/mobile/tsc_out.txt` | Delete |
| Lock `EXPO_PUBLIC_API_URL` to env-specific values | `packages/mobile/.env` | Document in README that this must point to the deployed backend URL before a prod build |
| Add `expo-haptics` to `app.config.ts` plugins | `app.config.ts` | `"expo-haptics"` |

---

## What Is Already Done — Do NOT Re-implement

- Email/password auth + Google OAuth (working, proxy flow intact)
- Token persistence + auto-refresh interceptor (SecureStore)
- All five tabs: Feed, Games, Library, Friends, Profile
- Game detail screen (hero, screenshots, similar games, add-to-library modal with library/status select)
- Library detail screen (filters, sort, edit-entry modal, move-library modal, remove game)
- Recommendations screen (generate, dismiss, refresh, infinite scroll)
- Steam modal (validate ID, import, unlink, unsync, remove all)
- Billing upgrade modal (Stripe checkout + portal via `WebBrowser`, verify subscription)
- Profile edit modal (display name, bio, avatar)
- Public user profile page (libraries, activity, friend status buttons)
- All reusable components: `ActivityCard`, `EmptyState`, `GameCard`, `LibraryCard`, `RatingStars`,
  `RecommendationCard`, `SkeletonCard`, `StatCard`, `StatusBadge`, `UserRow`
- Design token file (`src/constants/theme.ts`) and query key factories (`src/constants/queryKeys.ts`)

---

## Acceptance Criteria

Before marking this session complete, verify:

1. `npx tsc --noEmit` from `packages/mobile` exits with **0 errors**.
2. All 15 gaps above are addressed (or explicitly documented as deferred with a clear reason).
3. No screen has a hardcoded "coming soon" Alert as its primary action — use a stub screen or
   disabled state with a visible label instead.
4. `app.config.ts` has a valid icon, splash, and adaptiveIcon so `eas build --platform ios --profile
   preview` would not fail on asset validation.
5. Cold-start behaviour: after kill + reopen, `user.plan` is available before the Profile tab is
   visited.
