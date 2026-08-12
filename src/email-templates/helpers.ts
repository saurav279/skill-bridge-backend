import { env } from "../config/env";

export type BtnVariant = "primary" | "link";

export const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

export const heading = (text: string, level: 1 | 2 | 3 = 1): string => {
  return `<h${level}>${escapeHtml(text)}</h${level}>`;
};

export const paragraph = (text: string): string => {
  return `<p>${escapeHtml(text)}</p>`;
};

export const title = (text: string): string => {
  return `<p><strong>${escapeHtml(text)}</strong></p>`;
};

export const labeledValue = (label: string, value: string): string => {
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
};

export const btnLink = (
  url: string,
  label = "View Detailed Results",
  variant: BtnVariant = "primary",
): string => {
  if (variant === "link") {
    return `<p><a href="${escapeHtml(url)}" class="btn btn-link" style="display:inline;background:transparent;color:#2E62FD;padding:0;border-radius:0;text-decoration:none;font-size:14px;font-weight:500;">${escapeHtml(label)}</a></p>`;
  }

  return `<p><a href="${escapeHtml(url)}" class="btn btn-primary" style="display:inline-block;background-color:#2E62FD;color:#ffffff;padding:14px 36px;border-radius:999px;text-decoration:none;font-size:15px;font-weight:600;line-height:1.2;border:0;mso-padding-alt:0;">${escapeHtml(label)}</a></p>`;
};

export const ulList = (
  items: string[],
  emptyText = "No items listed.",
): string => {
  if (!items.length) {
    return `<ul><li>${escapeHtml(emptyText)}</li></ul>`;
  }

  return `<ul>${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
};

export const section = (headingText: string, content: string): string => {
  return `<div>${title(headingText)}${content}</div>`;
};

export const labeledRows = (
  rows: Array<{ label: string; value: string }>,
  emptyText = "No items listed.",
): string => {
  if (!rows.length) {
    return paragraph(emptyText);
  }

  return rows.map((row) => labeledValue(row.label, row.value)).join("");
};

export const stackedBlocks = (
  blocks: Array<{ title: string; body: string }>,
  emptyText = "No items listed.",
): string => {
  if (!blocks.length) {
    return paragraph(emptyText);
  }

  return blocks
    .map(
      (block) =>
        `<div>${title(block.title)}${paragraph(block.body)}</div>`,
    )
    .join("");
};

function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

export const textContent = {
  disclaimer:
    "This email is readiness guidance only and is not legal advice or a visa decision. Scoring is produced by Skill Bridge and is not related to any immigration authority.",
  contact(): string {
    const email = extractEmailAddress(env.smtp.user);
    return `<p>If you have any questions or feedback, please contact us at <a href="mailto:${escapeHtml(email)}" class="btn btn-link">${escapeHtml(email)}</a>.</p>`;
  },
};
