import { env } from "../config/env";
import type { Assessment } from "../types/assessment";
import {
  btnLink,
  heading,
  labeledRows,
  labeledValue,
  paragraph,
  section,
  stackedBlocks,
  textContent,
  ulList,
} from "./helpers";

export function assessmentEmailTemplate(assessment: Assessment): string {
  const name = assessment.customerName?.trim() || "there";
  const routeLabel = assessment.routeId.replaceAll("-", " ");
  const resultsUrl = `${env.frontendUrl}/assessment/${encodeURIComponent(assessment.id)}`;

  return `
  ${heading("Assessment Results")}
  ${paragraph(`Hi ${name},`)}
  ${paragraph(
    `Your Skill Bridge ${routeLabel} assessment has been completed. Here are your results:`,
  )}

  <div>
    ${labeledValue("Confidence score", `${assessment.confidenceScore}/100`)}
    ${labeledValue("Headline", assessment.headline)}
  </div>

  ${section("Summary", paragraph(assessment.summary))}

  ${section(
    "Section scores",
    labeledRows(
      assessment.breakdown.map((item) => ({
        label: item.label,
        value: `${item.score}/100`,
      })),
      "No section scores available.",
    ),
  )}

  ${section("Strengths", ulList(assessment.strengths))}

  ${section("Improvements", ulList(assessment.improvements))}

  ${section(
    "Priority improvements",
    stackedBlocks(
      assessment.priorityImprovements.map((item) => ({
        title: `${item.title} (${item.priority})`,
        body: item.description,
      })),
      "No priority improvements listed.",
    ),
  )}

  ${section(
    "Overall recommendation",
    paragraph(assessment.overallRecommendation),
  )}

  ${btnLink(resultsUrl)}

  ${textContent.contact()}
  ${paragraph(textContent.disclaimer)}
  `;
}
