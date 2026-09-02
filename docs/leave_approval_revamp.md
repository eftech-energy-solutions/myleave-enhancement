# Pending Leave Approval — Card Redesign Spec

## Context
This is the manager/director-facing queue of pending leave requests awaiting Approve/Reject action — distinct from the Leave History browsing page (see `leave-history-redesign-spec.md`), since this one is an **action queue**, not a read-only archive. Design priorities are different: speed of decision-making, low risk of misclicks, and enough context to decide without opening Details.

## Problems with the current card
1. **No total leave duration shown.** From/To dates are split into two separate fields; the manager has to mentally calculate the day count instead of seeing it directly (the history page already solved this with a "Days" column — this queue should too).
2. **"Remaining" is ambiguous.** It's not clear whether "Remaining: 6 day(s)" means the employee's leave balance after this request, or something else. Ambiguous labels slow down approval decisions.
3. **No urgency signal.** A request starting tomorrow and one starting in 6 weeks look identical. A manager scanning the queue has no visual cue for what needs deciding first.
4. **No conflict/overlap awareness.** If two teammates in the same department already have approved leave overlapping this request's dates, the manager has no way to know without manually cross-checking — which is exactly the kind of thing that should surface automatically before an approval decision.
5. **Reject is a full-weight solid red button**, same visual prominence as Approve. For a destructive, hard-to-undo action, this raises misclick risk — especially in a dense grid of similar-looking cards.
6. **No bulk action support.** If a manager has 20+ pending requests (e.g. after a holiday period), approving them one-by-one with no way to select multiple is slow.
7. **Inconsistent card height.** Cards with longer role/department text (e.g. "Prorated Employee • 12242 • Operations") wrap to more lines than others, breaking grid alignment.
8. **No sort control.** Only Department filter and Name/ID search exist — no way to sort by soonest start date or oldest request, which matters once the queue grows.
9. **Details button is visually disconnected** from the Approve/Reject action pair, floating separately on the right.

## Redesigned card layout

**Top row:** Employee name (bold) — Leave type badge (top right, unchanged position)
**Subtitle row:** Role • Staff ID • Department (single line; truncate with `…` and a tooltip on hover if it would overflow, rather than wrapping and growing the card)

**Date/duration row (combined, replaces separate From/To fields):**
`Sep 3 – Sep 3, 2026 · 1 day`
— one line, immediately answers "when" and "how long" together.

**Meta row:**
`Requested Aug 26 · Leave balance after approval: 6 days`
— rename "Remaining" to make explicit what it refers to (adjust wording to match actual system meaning — if it's something else, e.g. days left in this specific leave type's yearly quota, say that explicitly instead of "Remaining").

**Signal row (new, conditional — only appears when relevant):**
- **Starting soon** badge (e.g. amber, "Starts in 2 days") when leave start date is within a configurable threshold (e.g. 3 days) — surfaces decisions that are time-sensitive.
- **Overlap warning** badge (e.g. "2 others on leave that week") when other approved leave in the same department overlaps this request's date range — gives the manager staffing context before approving.
Both are optional/conditional; a card with neither shown stays visually calm — don't force empty badge space.

**Action row:**
- **Approve** — primary solid button (unchanged, green)
- **Reject** — secondary/outline style instead of solid red, to reduce visual weight and misclick risk while keeping it clearly available. Clicking Reject can optionally prompt for a short reason (useful for the employee to see later) without blocking with a heavy confirmation modal.
- **Details** — text-link style, placed directly adjacent to Reject (same row, same visual grouping) rather than floated separately.
- After Approve/Reject, show a brief **undo toast** ("Approved Fuji Samad's leave · Undo") for a few seconds instead of a blocking "Are you sure?" dialog — keeps the queue fast to work through while still giving a safety net for misclicks.

## Queue-level additions (above the cards)

- **Sort control** next to the existing Department filter and search box: "Sort by: Soonest start date" / "Oldest request first" (default to soonest start date, since that's usually what determines urgency).
- **Multi-select bulk approval** — see dedicated section below for full implementation detail.
- **Leave-type filter**, matching the Department filter already present, since Medical vs Annual/Emergency requests may warrant different scrutiny.

## Multi-select bulk approval — implementation instructions

Goal: let a manager act on several pending requests in one motion instead of clicking Approve/Reject on each card individually, without sacrificing the safety net of the undo pattern.

1. **Checkbox on every card.** Place it top-left inside the card padding (not floating outside the card border), roughly 16x16px, vertically aligned with the top of the name/subtitle block. Unchecked by default. This must not shift the rest of the card's layout when toggled.

2. **Selected-state styling.** When a card's checkbox is checked, give the card a `2px solid var(--border-accent)` border (this is the one approved exception to the standard 0.5px hairline border — used to accent selection). Do not change the card's background or internal spacing when selected — only the border.

3. **"Select all" control.** Place near the existing Department/search filter row — a single checkbox or link-style control that toggles all *currently visible* (i.e. filtered) cards' checkboxes at once. It should reflect an indeterminate state if some but not all visible cards are selected.

4. **Bulk action bar.** Appears only when 1 or more cards are selected; hidden entirely otherwise (don't reserve space for it when empty). Content: selected count (e.g. "3 selected"), an "Approve all" primary button, a "Reject all" outline/danger-text button (matching the single-card Reject styling), and a "Clear" text link to deselect everything. Make it sticky to the top of the scrollable card area so it stays reachable as the manager scrolls through a long queue.

5. **Bulk reject reason.** If single-card Reject prompts for an optional reason, bulk reject should offer the same optional reason field once, applied to all selected requests — don't force one reason-per-request in the bulk flow, that defeats the purpose of batching.

6. **Confirmation via undo, not a blocking dialog.** After Approve all / Reject all, show a single toast summarizing the action (e.g. "3 requests approved · Undo") rather than a native confirm() dialog per request or even one dialog for the batch. Selection clears automatically after the action completes.

7. **Selection state resets** when filters change in a way that would hide a selected card (e.g. switching Department filter) — don't let a manager bulk-approve a card they can no longer see. Simplest approach: clear all selections whenever the Department, Leave type, or Search filter changes; selection surviving a Sort change is fine since sort doesn't hide anything.

8. **Edge case: selecting across pagination (if the queue is paginated).** Recommend scoping "Select all" to the current page/view only, with the bulk action bar making that explicit if there's any ambiguity (e.g. "3 selected on this page"). Selecting across multiple pages silently is a common source of "I approved things I didn't mean to" bugs — avoid it unless there's a very small total record count where pagination isn't even needed.

## Visual consistency
- Fix card min-height so a 2-line subtitle doesn't push one card taller than its grid neighbors; truncate instead of wrap where needed.
- Keep the leave-type badge, card shadow/border, and grid spacing consistent with the existing design — the goal here is information density and action safety, not a full visual overhaul.

## Out of scope for this pass
- Auto-approval rules (e.g. auto-approve short medical leave under a day) — worth considering later but is a policy decision, not a UI one.
- Notifying the employee automatically on approve/reject — assume this already happens or is handled elsewhere in the system; not a card-level concern.