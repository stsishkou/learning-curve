# @lc/plan-content

The owner's courses and the generator built for them. Edit courses here, then `pnpm run plan`.

- `src/content.ts`: the calendars and the queue of items in each course.
- `src/schedule.ts`: the rules (`DEFAULT_CONFIG`) and `buildPlan`, which gives every item a date.

Depends on `@lc/plan-domain` only; no React, no Node.
