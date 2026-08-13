export const PACKAGE_NAMES = [
  "strategy-call",
  "leadership-enhancement",
  "diy-membership",
  "review-only",
  "full-review",
  "strategy-session",
  "bespoke-coaching",
] as const;

export type PackageName = (typeof PACKAGE_NAMES)[number];
