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



export function sanitizePackageName(packageName: PackageName): string {
  return packageName
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}