# BUG TRACKER — SynapChain (Frontend)
> Last updated: 2026-03-20
> Codebase: `chain-optimizer-pro-main/src`

---

## CRITICAL BUGS

| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| C1 | `contexts/AuthContext.tsx` | 36-45 | **Fake auth** — `login()` ignores email/password, always sets admin. `switchRole()` needs no auth. Entire auth system is demo-only. | OPEN |
| C2 | `contexts/AuthContext.tsx` | 36 | `_email` and `_password` are intentionally unused — no API call made at all | OPEN |
| C3 | `pages/NotFound.tsx` | 8 | `console.error()` left in production code | OPEN |
| C4 | All modal components | various | **Forms don't capture values** — inputs have no `value`/`onChange` bindings, form data is never collected | OPEN |
| C5 | All modal components | various | **No real API calls** — all submit handlers use `setTimeout()` fakes instead of fetch/axios | OPEN |
| C6 | Entire project | — | **Zero API client** — no axios instance, no base URL, no headers configured. App cannot talk to any backend | OPEN |

---

## MAJOR BUGS

| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| M1 | `tsconfig.json` | 4,6,13 | `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters` all false — hides real TypeScript errors | OPEN |
| M2 | `pages/Inventory.tsx` | 10-17 | All inventory data is a hardcoded static array `PRODUCTS` — no fetch from DB | OPEN |
| M3 | `pages/Orders.tsx` | 9-16 | All orders data is a hardcoded static array `ORDERS` — no fetch from DB | OPEN |
| M4 | `pages/Shipments.tsx` | 4-9 | All shipments hardcoded — no fetch | OPEN |
| M5 | `pages/Suppliers.tsx` | 9-14 | All suppliers hardcoded — no fetch | OPEN |
| M6 | `pages/AuditLog.tsx` | 6-17 | All audit logs hardcoded — no fetch | OPEN |
| M7 | `pages/Dashboard.tsx` | 20 | `dashboards[user.role]` has no fallback if role doesn't match — renders blank | OPEN |
| M8 | `pages/Dashboard.tsx` | 9-11 | `if (!user) return null` — shows blank screen instead of loading/redirect | OPEN |
| M9 | All modal `setTimeout` handlers | — | No cleanup in useEffect — state updated on unmounted components causing memory leaks | OPEN |
| M10 | `pages/Predictions.tsx` | 25-27 | AI prediction button uses `setTimeout(2000)` — no real AI API call | OPEN |
| M11 | All pages using animations | various | CSS class `animate-fade-in-up` is not defined — animations silently broken | OPEN |
| M12 | All forms | — | No input validation — numbers accept strings, emails not validated, required not enforced | OPEN |
| M13 | All forms | — | No try-catch / error boundaries — silent failures, users see no error messages | OPEN |
| M14 | Entire app | — | No React Error Boundary — any unhandled throw crashes the entire app | OPEN |
| M15 | `App.tsx` | 24 | `QueryClient` created but never used for real data fetching — dead code | OPEN |
| M16 | `components/modals/AddProductDialog.tsx` | 47 | `<Select required>` — `required` attr on custom Select component doesn't enforce browser validation | OPEN |
| M17 | `components/modals/CreateUserDialog.tsx` | 54 | Same `<Select required>` issue | OPEN |

---

## MINOR BUGS

| # | File | Line | Issue | Status |
|---|------|------|-------|--------|
| m1 | `components/dashboard/ActivityFeed.tsx` | 13 | Array index used as React `key` — breaks when list is reordered | OPEN |
| m2 | `pages/AuditLog.tsx` | 34 | `FILTER_LABELS[f]` can return `undefined` if filter value not in map | OPEN |
| m3 | Multiple pages | — | Animation delay magic numbers (60, 80, 100, 120, 180, 200) — no named constants | OPEN |
| m4 | All interactive components | — | Missing ARIA labels on buttons, inputs, icons — accessibility issues | OPEN |
| m5 | `components/layout/Sidebar.tsx` | 123 | Logout button has no loading state or confirmation | OPEN |
| m6 | `vite.config.ts` | 10 | Server port hardcoded to `8080` — should be env var | OPEN |
| m7 | Multiple modal components | — | Inconsistent button `variant` across modals (some `outline`, some default) | OPEN |
| m8 | `components/ui/stat-card.tsx` | 14 | Missing explicit React import — relies entirely on JSX transform | OPEN |

---

## BUG SUMMARY

| Severity | Count |
|----------|-------|
| Critical | 6 |
| Major | 17 |
| Minor | 8 |
| **Total** | **31** |

---

## PRIORITY FIX ORDER
1. C6 — Set up API client (axios instance) with base URL + auth headers
2. C1/C2 — Replace demo auth with real JWT login API call
3. C4/C5 — Add controlled inputs + real API calls in all modals
4. M2-M6 — Replace all hardcoded data with React Query + API fetches
5. M13/M14 — Add try-catch and Error Boundary
6. M8 — Add proper loading state in Dashboard
7. M11 — Define `animate-fade-in-up` in Tailwind config
8. M1 — Enable TypeScript strict mode
9. C3 — Remove console.error from NotFound.tsx
10. m1-m8 — Minor cleanup
