# SnapTrack — Handoff Instructions for Continuing Agent

## Context

SnapTrack is a mobile-first food logging PWA built on the Cloudflare stack. Users photograph
meals, a Workers AI vision model identifies the food and estimates calories/macros, and the
user confirms the log entry. **Photos are never stored** — they are passed ephemerally to
Workers AI and discarded. No R2, no image storage of any kind.

This document describes exactly what has been built, what has not, and what you need to write
to complete the app.

---

## Repo location

```
/Users/henrywong/Documents/Personal Dev/hwong103/snaptrack
```

---

## What already exists (do not recreate)

### Config / build files (all complete)

| File | Status |
|---|---|
| `package.json` | ✅ Complete |
| `wrangler.jsonc` | ✅ Complete |
| `vite.config.ts` | ✅ Complete |
| `tsconfig.json` | ✅ Complete |
| `tsconfig.app.json` | ✅ Complete |
| `tsconfig.node.json` | ✅ Complete |
| `index.html` | ✅ Complete — includes PWA meta tags |
| `public/manifest.json` | ✅ Complete |
| `.gitignore` | ✅ Complete |
| `.dev.vars.example` | ✅ Complete |

### Worker source files (all complete, do not modify)

| File | Status |
|---|---|
| `workers/src/crypto.ts` | ✅ Complete — AES-GCM encrypt/decrypt, PBKDF2 salt = `snaptrack-auth-key` |
| `workers/src/auth.ts` | ✅ Complete — better-auth, magic link + Google OAuth |
| `workers/src/snap.ts` | ✅ Complete — ephemeral Workers AI vision handler, exports `SnapResult` interface |
| `workers/src/log.ts` | ✅ Complete — food_logs CRUD (create, day, history, delete, patch) |
| `workers/src/profile.ts` | ✅ Complete — user profile upsert + Mifflin-St Jeor goal suggestion |
| `workers/src/index.ts` | ✅ Complete — main router, all routes wired |

### D1 migrations (all complete)

| File | Status |
|---|---|
| `workers/migrations/0001_better_auth.sql` | ✅ Complete |
| `workers/migrations/0002_profile.sql` | ✅ Complete |
| `workers/migrations/0003_food_logs.sql` | ✅ Complete |

### Frontend — partial

| File | Status |
|---|---|
| `src/main.tsx` | ✅ Complete |
| `src/index.css` | ✅ Complete — Tailwind v4, dark theme, safe area insets |
| `src/services/api.ts` | ✅ Complete — all typed fetch wrappers |
| `src/services/compressImage.ts` | ✅ Complete — Canvas API compression to ~200KB JPEG |
| `src/hooks/useAuth.ts` | ✅ Complete — session + profile load, `needsOnboarding` flag |
| `src/hooks/useDay.ts` | ✅ Complete — fetches day log, exposes `refresh` |
| `src/hooks/useHistory.ts` | ❌ Missing — must write |
| `src/App.tsx` | ❌ Missing — must write |
| `src/components/AuthScreen.tsx` | ❌ Missing — must write |
| `src/components/Onboarding.tsx` | ❌ Missing — must write |
| `src/components/DayView.tsx` | ❌ Missing — must write |
| `src/components/CameraCapture.tsx` | ❌ Missing — must write |
| `src/components/SnapResult.tsx` | ❌ Missing — must write |
| `src/components/ManualEntry.tsx` | ❌ Missing — must write |
| `src/components/HistoryView.tsx` | ❌ Missing — must write |
| `src/components/SettingsView.tsx` | ❌ Missing — must write |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind v4 |
| Hosting | Cloudflare Pages (via wrangler assets) |
| Worker | Cloudflare Workers (TypeScript) |
| Auth | better-auth — magic link + Google OAuth |
| Database | Cloudflare D1 (SQLite) |
| Cache/tokens | Cloudflare KV |
| AI | Cloudflare Workers AI — `@cf/llama-3.2-11b-vision-instruct` |
| Email | Resend |

---

## API surface (worker routes — all implemented)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/session` | Returns `{ authenticated, user? }` |
| `POST` | `/api/auth/*` | better-auth — magic link + Google |
| `POST` | `/api/snap` | Ephemeral vision analysis — body: `{ imageBase64, mimeType }` |
| `POST` | `/api/log` | Create food log entry |
| `GET` | `/api/day?date=YYYY-MM-DD` | Day's logs + totals + goal |
| `GET` | `/api/history?from=YYYY-MM-DD&to=YYYY-MM-DD` | Daily summaries |
| `DELETE` | `/api/log/:id` | Delete entry |
| `PATCH` | `/api/log/:id` | Edit entry fields |
| `GET` | `/api/profile` | Get user profile |
| `POST` | `/api/profile` | Create/update profile + goal suggestion |

### Key response shapes

**`GET /api/day`**
```typescript
{
  date: string;
  logs: LogEntry[];
  total_kcal: number;
  goal_kcal: number;
  remaining_kcal: number;
  // burned_kcal and net_kcal are Phase 2 (RunViz) — not present
}
```

**`POST /api/snap`** — returns `SnapResult` on success:
```typescript
{
  name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;   // 0–100
  notes: string;
}
// Error shapes:
// { error: 'no_food_detected' }  → HTTP 422
// { error: 'vision_failed' }     → HTTP 500
// { error: 'Unauthorized' }      → HTTP 401
```

**`POST /api/profile`** — returns:
```typescript
{ daily_goal_kcal: number; goal_suggested: boolean }
```

---

## Key import paths to use in components

```typescript
// Shared type from worker
import type { SnapResult } from '../../workers/src/snap';

// All API calls and types
import {
  getSession, snap, logCreate, logDay, logHistory,
  logDelete, logPatch, profileGet, profileUpsert
} from '../services/api';
import type {
  LogEntry, DayResponse, HistoryResponse,
  HistoryDay, UserProfile
} from '../services/api';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useDay } from '../hooks/useDay';
import { useHistory } from '../hooks/useHistory';

// Image compression
import { compressImage } from '../services/compressImage';
```

---

## Styling conventions

- **Framework**: Tailwind v4 — imported via `@tailwindcss/vite` plugin, no `tailwind.config.js` needed
- **Theme**: Dark only. Base background `#09090b` (zinc-950), text zinc-100/400/500
- **Accent colours**:
  - Positive / on-track / success: `emerald-500`
  - Warning / over budget: `amber-500`
  - Error / over goal: `red-500`
  - Primary button: emerald-500 bg
- **Mobile-first**: Max content width `max-w-md mx-auto`. No sidebars.
- **Safe areas**: `pb-[env(safe-area-inset-bottom)]` or the `safe-bottom` utility from `index.css`
- **Touch targets**: Minimum `h-11` (44px) on all tappable elements
- **No external UI libraries** — Tailwind classes only, no shadcn, no headlessui

---

## Files to write

Use `Filesystem:write_file` for each file. Write directly to the user's machine paths.
**Do not use bash** — bash writes to a temporary container, not to the user's filesystem.

Write in this order:

### 1. `src/hooks/useHistory.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { logHistory } from '../services/api';
import type { HistoryResponse } from '../services/api';

export function useHistory() {
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function getRangeDates(r: 'week' | 'month'): { from: string; to: string } {
    const today = new Date();
    const to = today.toISOString().split('T')[0]!;
    const from = new Date(today);
    if (r === 'week') from.setDate(today.getDate() - 6);
    else from.setDate(today.getDate() - 29);
    return { from: from.toISOString().split('T')[0]!, to };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getRangeDates(range);
      setData(await logHistory(from, to));
    } catch {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, error, range, setRange, refresh: load };
}
```

---

### 2. `src/App.tsx`

Three-state auth gate: unauthenticated → `<AuthScreen />`, authenticated + no profile →
`<Onboarding onComplete={refresh} />`, authenticated + profile → `<BrowserRouter>` with routes.

Routes:
- `/` → `<DayView />`
- `/history` → `<HistoryView />`
- `/settings` → `<SettingsView onSignOut={refresh} />`
- `*` → redirect to `/`

Show a full-screen spinner (emerald border-t on zinc border) while `loading` is true.

---

### 3. `src/components/AuthScreen.tsx`

Sign-in screen. Uses `better-auth` client:

```typescript
import { createAuthClient } from 'better-auth/react';
const authClient = createAuthClient();
```

- Magic link: `await authClient.signIn.magicLink({ email, callbackURL: '/' })`
- Google: `await authClient.signIn.social({ provider: 'google', callbackURL: '/' })`

Layout:
- Centred card on zinc-950 background
- "SnapTrack" wordmark (bold, large)
- Subtitle: "Photo-first calorie logging"
- Google button (full width, zinc-800 bg)
- Divider "or"
- Email input + "Send sign-in link" button
- Success state after magic link: "Check your email for a sign-in link"
- Error state: show error message in red

---

### 4. `src/components/Onboarding.tsx`

Props: `{ onComplete: () => Promise<void> }`

**Step 1 — Details** (all optional):
- Display name (text)
- Age (number, 10–100)
- Sex (button group: Male / Female / Other → `'male'|'female'|'other'`)
- Height cm (number)
- Weight kg (number)
- Activity level (select or pill group):
  - "Sedentary" → `'sedentary'`
  - "Lightly active" → `'light'`
  - "Moderately active" → `'moderate'`
  - "Active" → `'active'`
  - "Very active" → `'very_active'`
- "Next →" button: calls `profileUpsert({ display_name, age, sex, height_cm, weight_kg, activity_level })`
  - Response includes `{ daily_goal_kcal, goal_suggested }` — pass to step 2
- "Skip" link: goes to step 2 with default 2000 kcal, `goal_suggested: false`

**Step 2 — Goal**:
- If `goal_suggested`: show "Based on your details, we suggest {X} kcal/day"
- Range slider: `min=1200 max=4000 step=50`, pre-set to suggested or 2000
- Large display of current slider value
- "Confirm {value} kcal" primary button → calls `profileUpsert({ daily_goal_kcal: sliderValue })` then `onComplete()`
- "Use 2,000 kcal" text link → calls `profileUpsert({ daily_goal_kcal: 2000 })` then `onComplete()`

---

### 5. `src/components/DayView.tsx`

Main screen. Uses `useDay(selectedDate)` where `selectedDate` is state, defaulting to today.

**Helper — today's ISO string:**
```typescript
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

**Helper — format unix timestamp as HH:MM:**
```typescript
function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
```

**Helper — aggregate macros from logs:**
```typescript
const protein = logs.reduce((s, l) => s + (l.protein_g ?? 0), 0);
const carbs   = logs.reduce((s, l) => s + (l.carbs_g   ?? 0), 0);
const fat     = logs.reduce((s, l) => s + (l.fat_g     ?? 0), 0);
```

**Layout:**

1. **Header** — `{date formatted as "Fri, 20 Mar"}` with `<` and `>` chevron buttons to step days.
   Tapping the date label resets to today.

2. **Calorie ring** — SVG `viewBox="0 0 120 120"`:
   - Background circle: `stroke="#27272a"` (zinc-800), `strokeWidth=10`, `r=50`, `cx=60 cy=60`
   - Progress circle: `stroke` emerald if under goal, amber if >90% used, red if over. Use `strokeDasharray` / `strokeDashoffset`.
   - Centre text: `total_kcal` large, `"kcal"` small beneath
   - Below ring: `{remaining_kcal} kcal remaining` or `{over} kcal over goal` in appropriate colour

3. **Macro pills** — three small zinc-800 rounded pills: `{Math.round(protein)}g protein`, `{Math.round(carbs)}g carbs`, `{Math.round(fat)}g fat`

4. **Log list** — `data.logs` mapped to rows:
   - Left: food name (font-medium, truncate) + time below in zinc-400
   - Right: `{entry.calories} kcal` + small `AI` badge (emerald text) if `source === 'vision'`
   - Delete: long-press or swipe reveals a red Delete button — calls `logDelete(id)` then `refresh()`
   - Tap: opens inline edit sheet (simple form to edit name/calories — calls `logPatch` then `refresh()`)

5. **Empty state** — if `logs.length === 0`: "Nothing logged yet — snap a photo or add manually"

6. **Bottom action bar** — fixed, `bottom-0`, with `pb-[env(safe-area-inset-bottom)]`:
   - History icon (left) → `useNavigate()('/history')`
   - Large camera button (centre, emerald circle) → opens CameraCapture
   - Plus button (right of camera) → opens ManualEntry
   - Settings icon (right) → `useNavigate()('/settings')`

**Sheet state machine** — `type Sheet = null | 'camera' | { type: 'snap'; result: SnapResult } | 'manual' | { type: 'edit'; entry: LogEntry }`:

When sheet is `'camera'`: render `<CameraCapture onResult={(r) => setSheet({ type: 'snap', result: r })} onError={setError} onCancel={() => setSheet(null)} />`

When sheet is `{ type: 'snap', result }`: render `<SnapResult result={result} onConfirm={async (entry) => { await logCreate(entry); await refresh(); setSheet(null); }} onRetry={() => setSheet('camera')} onCancel={() => setSheet(null)} />`

When sheet is `'manual'`: render `<ManualEntry onConfirm={async (entry) => { await logCreate(entry); await refresh(); setSheet(null); }} onCancel={() => setSheet(null)} />`

---

### 6. `src/components/CameraCapture.tsx`

Props:
```typescript
interface Props {
  onResult: (result: SnapResult) => void;
  onError: (msg: string) => void;
  onCancel: () => void;
}
```

Imports:
```typescript
import { useRef, useState, useEffect } from 'react';
import { compressImage } from '../services/compressImage';
import { snap } from '../services/api';
import type { SnapResult } from '../../workers/src/snap';
```

Implementation:
- Hidden `<input ref={inputRef} type="file" accept="image/*" capture="environment" />`
- `useEffect(() => { inputRef.current?.click(); }, [])` — auto-opens camera on mount
- While processing: full-screen dark overlay with spinner and "Analysing your meal…"
- On `no_food_detected`: show message + "Try again" button (re-clicks input) + "Enter manually" button (calls `onCancel`, parent switches to ManualEntry)
- On other error: show message + "Try again"
- On success: call `onResult(snapData)`

Flow:
```typescript
async function handleFile(e) {
  const file = e.target.files?.[0];
  if (!file) { onCancel(); return; }
  setAnalysing(true);
  try {
    const { base64, mimeType } = await compressImage(file);
    const result = await snap(base64, mimeType);
    onResult(result);
  } catch (err: any) {
    const msg = err?.data?.error;
    if (msg === 'no_food_detected') setErrorState('no_food');
    else setErrorState('failed');
  } finally {
    setAnalysing(false);
    if (inputRef.current) inputRef.current.value = '';
  }
}
```

---

### 7. `src/components/SnapResult.tsx`

Props:
```typescript
interface Props {
  result: SnapResult;
  onConfirm: (entry: Omit<LogEntry, 'id'>) => Promise<void>;
  onRetry: () => void;
  onCancel: () => void;
}
```

State: editable copies of `result.name`, `result.calories`, `result.protein_g`, `result.carbs_g`, `result.fat_g`.

Confidence badge logic:
- `confidence >= 85`: no badge
- `60 <= confidence < 85`: amber "Low confidence — please review"
- `confidence < 60`: red "Very uncertain — edit before logging"

"Log it" handler:
```typescript
await onConfirm({
  logged_at: Math.floor(Date.now() / 1000),
  name: editedName,
  calories: editedCalories,
  protein_g: editedProtein,
  carbs_g: editedCarbs,
  fat_g: editedFat,
  confidence: result.confidence,
  notes: result.notes,
  source: 'vision',
});
```

Layout: bottom sheet style (rounded-t-2xl, fixed bottom-0, full width, dark bg).
Show food name large and editable, calories large and editable, macros row, confidence badge, notes in muted text, two buttons.

---

### 8. `src/components/ManualEntry.tsx`

Props: `{ onConfirm: (entry: Omit<LogEntry, 'id'>) => Promise<void>; onCancel: () => void }`

Fields: name (required), calories (required), protein_g, carbs_g, fat_g (all optional numbers).

Validate name and calories before submitting. Show inline errors.

"Log" handler:
```typescript
await onConfirm({
  logged_at: Math.floor(Date.now() / 1000),
  name,
  calories: Number(calories),
  protein_g: protein ? Number(protein) : null,
  carbs_g: carbs ? Number(carbs) : null,
  fat_g: fat ? Number(fat) : null,
  confidence: null,
  notes: null,
  source: 'manual',
});
```

---

### 9. `src/components/HistoryView.tsx`

Uses `useHistory()` hook. Back button → `useNavigate()('/')`.

**Week / Month toggle** — two buttons, active state gets emerald text + zinc-800 bg.

**Bar chart** (pure CSS — no library):
- Container: `flex items-end gap-1 h-32`
- For each day in `data.days`: a div with height `${Math.min((day.total_kcal / data.goal_kcal) * 100, 100)}%`
- Bar colour: `bg-emerald-500` if ≤ goal, `bg-amber-500` if over
- Show a dashed line at 100% height representing goal (use `position: relative` on container, `position: absolute` on the line)
- X-axis labels: show day of week abbreviated (Mon, Tue…) below each bar

**Day list** below chart:
- Date formatted: "Mon 17 Mar"
- Total vs goal: "{total} / {goal} kcal"
- Entry count: "{n} entries"
- Colour dot: emerald if under, amber if over

Empty state: "No food logged in this period — start by snapping a photo"

---

### 10. `src/components/SettingsView.tsx`

Props: `{ onSignOut: () => Promise<void> }`

Uses `useAuth()` to get `user` and `profile`. Back button → `useNavigate()('/')`.

```typescript
import { createAuthClient } from 'better-auth/react';
const authClient = createAuthClient();
```

**Goal & profile section:**
- Display name input (pre-filled from `profile.display_name`)
- Daily calorie goal: number input or slider (1200–4000, step 50), pre-filled from `profile.daily_goal_kcal`
- Activity level select, pre-filled from `profile.activity_level`
- "Save" button → `profileUpsert({ display_name, daily_goal_kcal, activity_level })`
- Show success toast/message after save

**Account section:**
- Email: read-only display of `user?.email`
- "Sign out" button → `await authClient.signOut()` then `onSignOut()`

**Coming soon section** (visually greyed out, `pointer-events-none opacity-40`):
- "Connect RunViz" row with a lock icon and label "Sync activity calories — Phase 2"

---

## After writing all files

Run in terminal to verify:
```bash
cd ~/Documents/Personal\ Dev/hwong103/snaptrack
npm install
npx tsc -b --noEmit
npm run build
```

Fix all TypeScript errors. Common ones to watch for:
- `SnapResult` imported from `'../../workers/src/snap'` — path must be exact
- `LogEntry` type is imported from `'../services/api'`, not from the worker
- `useNavigate` requires the component to be inside a `<BrowserRouter>` — DayView, HistoryView, SettingsView are rendered inside the router in App.tsx so this is fine
- `better-auth/react` `createAuthClient()` — call at module level, not inside a component

---

## First-run setup (if Cloudflare resources not yet provisioned)

```bash
cd ~/Documents/Personal\ Dev/hwong103/snaptrack

# 1. Create D1 database
npx wrangler d1 create snaptrack-db
# Copy the database_id output into wrangler.jsonc

# 2. Create KV namespace
npx wrangler kv:namespace create TOKENS
# Copy the id output into wrangler.jsonc

# 3. Set up local env
cp .dev.vars.example .dev.vars
# Edit .dev.vars with real values

# 4. Apply migrations locally
npx wrangler d1 migrations apply snaptrack-db --local

# 5. Dev (Vite only — for frontend iteration)
npm run dev

# 6. Full stack dev (worker + frontend)
npm run preview:worker
```

---

## Out of scope — do not build in Phase 1

- Any Strava API integration in SnapTrack
- `app_links` D1 table
- `/api/link/*` routes
- `/api/runviz/*` routes
- `burned_kcal` / `net_kcal` fields
- The Settings "Connect RunViz" entry should be **present but greyed out and non-interactive**
