# Session 4 Notes — Shared Component Library

> Read this at the start of Session 5 alongside CONTEXT.md and plan.md.

_Done: 2026-05-01_

---

## What was built

### Component library (`src/components/`)

All shared UI primitives used by every feature from Session 5 onward.

| Component | Type | Notes |
|---|---|---|
| `Card` | Server | Paper bg, 14px radius (`rounded-card`), 1px `--line` border. No shadow. |
| `Pill` | Server | Status + role pills. Covers all `JobStatus` + `Role` variants + `'overdue'`. Labels are lowercase. |
| `Btn` | Client | 3 variants: `primary` (terracotta), `secondary` (line border), `ghost`. 3 sizes: `sm / md / lg`. Lowercase + weight-500. |
| `Field` | Server | Label + optional hint/error text. Wraps `Input` or `Select` as children. |
| `Input` | Client | `forwardRef`. Error state (terracotta border). Terracotta focus ring. |
| `Select` | Client | Same treatment as `Input`. Wraps `<option>` children. |
| `Toast` | Client | `ToastProvider` wraps layout. `useToast()` hook exposes `.success()`, `.warning()`, `.error()`. Auto-dismisses after 4s. `aria-live="polite"`. |
| `Modal` | Client | Overlay (`bg-black/50`) + card. `shadow-xl`. Escape key closes. Body scroll lock. Accepts optional `title` prop. |

### Utility

- `src/lib/utils/cn.ts` — simple class-name joiner (`...classes.filter(Boolean).join(' ')`). No external dependency.

### Layout update

- `src/app/layout.tsx` — `ToastProvider` now wraps `{children}` in `<body>`.

---

## Key decisions to remember

| Decision | Why |
|---|---|
| No `clsx` / `tailwind-merge` dependency | Not needed at this scale; `cn()` utility is sufficient. Add later if class conflicts emerge. |
| `Card` has no default padding | Padding varies per use case. Callers pass `className="p-6"` or similar. |
| `Btn` is `'use client'` | Accepts `onClick` via `ButtonHTMLAttributes` — must be a client component. |
| `Field` is a server component | It only wraps children with a label — no interactivity needed at the wrapper level. |
| `Input` + `Select` use `forwardRef` | Required for react-hook-form compatibility in Session 6 (job-detail form). |
| Toast uses `crypto.randomUUID()` for IDs | Stable, no import needed. Available in all modern browsers and Node 19+. |
| Modal uses `bg-black/50` for overlay | CSS var colors (`var(--ink)`) don't support Tailwind's `/` opacity modifier — built-in `black` does. |
| `hover:brightness-90` on primary Btn | Same opacity-modifier limitation. `brightness` filter works on any background color. |

---

## Files added / changed this session

```
src/lib/utils/cn.ts               — class name joiner utility
src/components/Card.tsx           — server component
src/components/Pill.tsx           — server component
src/components/Btn.tsx            — client component
src/components/Field.tsx          — server component
src/components/Input.tsx          — client component (forwardRef)
src/components/Select.tsx         — client component (forwardRef)
src/components/Toast.tsx          — ToastProvider + useToast hook
src/components/Modal.tsx          — client component
src/app/layout.tsx                — added ToastProvider wrapper
docs/plan.md                      — Session 4 marked complete
```

---

## How to use in Session 5+

```tsx
// Card
<Card className="p-6">...</Card>

// Pill
<Pill variant="scheduled" />
<Pill variant="installer" />

// Btn
<Btn variant="primary">approve & schedule</Btn>
<Btn variant="secondary" size="sm">send back</Btn>
<Btn variant="ghost" onClick={onClose}>cancel</Btn>

// Field + Input
<Field label="Client name" htmlFor="client" error={errors.client?.message}>
  <Input id="client" error={!!errors.client} {...register('client')} />
</Field>

// Field + Select
<Field label="Status" htmlFor="status">
  <Select id="status" {...register('status')}>
    <option value="pending">pending</option>
    <option value="scheduled">scheduled</option>
  </Select>
</Field>

// Toast (in any client component)
const toast = useToast()
toast.success('Job saved')
toast.warning('Clash detected on this date')
toast.error('Failed to save — try again')

// Modal
const [open, setOpen] = useState(false)
<Modal isOpen={open} onClose={() => setOpen(false)} title="Mark job complete">
  ...
</Modal>
```

---

## What's next — Session 5

Schedule feature (read-only first):
- List view (default) — jobs grouped by date
- Week view — 7-column grid
- Month view — calendar grid
- Search bar
- Role-aware rendering (sales/scheduler see all; installer sees assigned only)
- Data via `src/lib/supabase/queries/jobs.ts`
- All views use `Card`, `Pill`, `Btn` from this session
