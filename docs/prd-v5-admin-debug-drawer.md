# PRD: V5 Admin Debug Drawer — Move Session Text to Slide-Out Panel

## Problem

During v5 treatment sessions in Orb mode (`orb_ptt`), the message history (chat bubbles showing AI steps, user responses, and internal state transitions) renders in a scrollable area below the Orb. This creates two issues:

1. **Visual clutter for end users** — The scrolling text behind/below the Orb breaks the immersive, meditative feel of the Shifting experience. Users should see only the Orb, the subtitle line, and the control buttons — nothing else.

2. **Loss of debugging visibility** — The message history is extremely valuable for testing. Admins and testers rely on it to verify step transitions, AI prompt quality, state machine routing, and treatment modality progression. Removing it entirely would cripple the testing workflow.

### Current behavior

- `TreatmentSession.tsx` renders a fixed-position container with the Orb block (`flex-shrink-0`) stacked above a `flex-1 overflow-y-auto` message scroll area (line ~2279).
- Both are always visible. During Orb mode, the message area sits directly below the Orb, visually competing with the immersive experience.
- All users — regardless of role — see the message history.

---

## Solution

Replace the in-page message scroll area with an **admin-only slide-out drawer** that opens from the right edge of the screen. The drawer is invisible to non-admin users. For admins, a thin vertical tab hugs the right edge of the viewport; tapping/clicking it slides the drawer open, revealing the full message history and step log.

### Design principles

- **Immersion first** — Regular users see only the Orb, subtitle, status line, and controls. Zero text clutter.
- **Zero data loss** — All messages and steps still render; they're just relocated into the drawer.
- **Discoverable but unobtrusive** — The right-edge tab is subtle enough not to distract during testing, but obvious enough that an admin knows it's there.
- **No new dependencies** — Build with Tailwind utility classes and existing animation patterns (the codebase already has `animate-in`, `slide-in-from-bottom`, and inline slide/transform patterns in `SwipeableSheet`, `ActionSheet`, and `MobileNav`).

---

## Requirements

### R1: Admin Debug Drawer component

Create a new component: `components/treatment/v5/AdminDebugDrawer.tsx`

**Behavior:**
- Renders a right-edge drawer panel that slides in/out horizontally.
- Default state: **closed** (off-screen to the right).
- Contains the full message history that currently lives in the `flex-1 overflow-y-auto` div (lines ~2279–2343 of `TreatmentSession.tsx`).
- Auto-scrolls to the bottom as new messages arrive (preserve existing `messagesEndRef` scroll behavior).
- Drawer width: `w-80 sm:w-96` (320px mobile, 384px desktop) — enough to comfortably read message bubbles without overwhelming the Orb view.

**Edge tab (toggle handle):**
- A thin vertical tab fixed to the right edge of the viewport when the drawer is closed.
- Positioned vertically centered on the right edge.
- Displays a small icon or rotated text label (e.g., "Debug" or a `ChevronLeft` icon).
- Styled subtly: semi-transparent background, small font, blends with the session UI.
- On click/tap: slides the drawer open. When open, the tab stays attached to the drawer's left edge and its icon flips to indicate "close" direction.
- Z-index must sit above the Orb container but below any modals (suggested: `z-40`).

**Drawer panel:**
- Background: `bg-card/95 backdrop-blur-sm` — slightly transparent so the Orb peeks through, reinforcing spatial context.
- Border: `border-l border-border`.
- Full height: `fixed top-0 right-0 bottom-0` (or `top-header-safe` to clear the page header).
- Contains the same message rendering loop currently in TreatmentSession (`.map((message) => ...)`).
- Smooth slide animation: `transition-transform duration-300 ease-in-out`, toggling between `translate-x-0` (open) and `translate-x-full` (closed).

**No overlay/backdrop:**
- The drawer is non-modal. No backdrop, no click-outside-to-close. The admin interacts with the Orb and session controls freely while the drawer is open. This is critical for testing — the drawer must never interfere with the session flow.

### R2: Admin-only visibility

**Gate the entire drawer on admin role.** The component should not render at all for non-admin users.

- Use the existing `useAuth()` hook to get `profile.role`.
- Render condition: `profile.role === 'super_admin' || profile.role === 'tenant_admin'`.
- This matches the existing `ADMIN_ROLES` pattern used in `MobileNav.tsx` (line 42).
- No server-side gating needed — this is a client-side debug UI reading the same messages already present in client state.

### R3: Conditional message area rendering in TreatmentSession

**When Orb mode is active AND user is admin:**
- Hide the inline message scroll area (the `flex-1 overflow-y-auto` div).
- Pass `messages`, `messagesEndRef`, and relevant rendering props to `AdminDebugDrawer`.
- The Orb block expands to fill the available space, creating a cleaner, more centered layout.

**When Orb mode is active AND user is NOT admin:**
- Hide the inline message scroll area entirely.
- Do not render `AdminDebugDrawer`.
- The user sees only: Orb, subtitle, status, controls, and input area.

**When Orb mode is NOT active (text_first or listen_only):**
- Keep the inline message area exactly as-is. No changes to non-Orb layouts.
- `AdminDebugDrawer` is not rendered (it's an Orb-mode-only feature).

### R4: Lock-open behavior and live updating

The drawer is a **testing tool** — it must stay open and stay current while the admin observes a session in progress.

**Lock-open:**
- Once an admin opens the drawer, it stays open. It does not close on outside clicks, on Orb interactions, or on any session state transitions (step changes, modality switches, PTT start/stop).
- The only way to close the drawer is to explicitly click the edge tab again or press the keyboard shortcut.
- No backdrop/overlay — the drawer sits alongside the Orb without blocking interaction with the session. The admin can keep the Orb fully usable (PTT, skip, etc.) while the drawer is open.

**Live updating:**
- As new messages arrive (AI responses, user inputs, system/step messages), they appear in the drawer immediately — the same reactive rendering that the inline message area uses today.
- The drawer auto-scrolls to the latest message on each new arrival, so the admin always sees the most recent step without manual scrolling.
- If the admin has scrolled up to inspect an earlier message, auto-scroll pauses (scroll-aware: only auto-scroll when the admin is already at or near the bottom). When the admin scrolls back to the bottom, auto-scroll resumes.

**State persistence:**
- Store the drawer's open/closed state in `localStorage` (key: `v5_debug_drawer_open`) so it persists across page reloads during a testing session.
- Default: closed. Once opened during a test session, it stays open even through page refreshes.

### R5: Keyboard shortcut (nice-to-have)

- `Ctrl+D` / `Cmd+D` toggles the drawer open/closed (admin-only).
- Prevents conflict with browser bookmark shortcut — if conflict exists, use `Ctrl+Shift+D` instead.

---

## Component API sketch

```tsx
interface AdminDebugDrawerProps {
  messages: TreatmentMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
  isOpen: boolean;
  onToggle: () => void;
}
```

The parent (`TreatmentSession`) owns the open/closed state and passes it down. This keeps the drawer stateless and testable.

---

## Implementation sequence

### Step 1: Create `AdminDebugDrawer` component
- Build the drawer shell: fixed positioning, slide animation, edge tab.
- Accept `messages` and render them using the same markup currently in the messages area.
- Wire up open/close toggle with localStorage persistence.

### Step 2: Integrate into `TreatmentSession`
- Import and conditionally render `AdminDebugDrawer` when `isGuidedMode && isAdmin`.
- Add `isAdmin` derivation from `useAuth()` (already available via props or context).
- When drawer is active, hide the inline message scroll area via conditional rendering.
- Ensure `messagesEndRef` scroll-into-view still works inside the drawer.

### Step 3: Clean up Orb layout
- When the inline message area is hidden, adjust the Orb container's flex layout so it centers vertically in the viewport rather than being pushed to the top.
- Ensure subtitle, status, and control buttons remain correctly positioned.

### Step 4: Test matrix
- Admin in Orb mode → drawer tab visible, drawer works, no inline messages.
- Non-admin in Orb mode → no drawer, no inline messages, clean Orb view.
- Admin in text_first mode → normal inline messages, no drawer.
- Admin in listen_only mode → normal inline messages, no drawer.
- Drawer locks open — does not close on Orb tap, PTT hold, step transitions, or modality changes.
- Drawer live-updates — new messages appear immediately as they're added.
- Drawer auto-scrolls to latest message when admin is at the bottom.
- Drawer pauses auto-scroll when admin has scrolled up; resumes when they scroll back down.
- Drawer state persists across reload (stays open if it was open).
- Drawer does not interfere with PTT (push-to-talk) touch events on the Orb.
- Full session flow (start → shifting → steps → completion) works with drawer open the entire time.

---

## Files affected

| File | Change |
|---|---|
| `components/treatment/v5/AdminDebugDrawer.tsx` | **New** — drawer component |
| `components/treatment/v5/TreatmentSession.tsx` | Conditional rendering: hide inline messages in Orb mode, render drawer for admins |
| `lib/auth.tsx` | No changes needed — `useAuth()` already exposes `profile.role` |

---

## Out of scope

- Changing the message format or adding new debug info to the drawer (future enhancement).
- Making the drawer available in non-Orb interaction modes.
- Server-side logging or admin analytics for session steps.
- Drawer resize/snap-point drag behavior (keep it simple — fixed width, open/close only).
