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

export function adminAssessmentEmailTemplate({
  assessment,
  livesInUK,
  currentVisa,
  resumeLink,
}: {
  assessment: Assessment;
  livesInUK: string | undefined;
  currentVisa: string | undefined;
  resumeLink: string | undefined;
}): string {
  const name = assessment.customerName?.trim() || "there";
  const resultsUrl = `${env.frontendUrl}/assessment/${encodeURIComponent(assessment.id)}`;

  return `
  ${heading(`New Assessment Report: ${name}`)}
  ${paragraph(`Hi Admin,`)}
  ${paragraph(
    `A new assessment report has been generated for ${name}.`,
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

  ${livesInUK ? labeledValue("Lives in UK", livesInUK) : ""}
  ${labeledValue("Current visa", currentVisa?.trim() || "—")}

  ${btnLink(resultsUrl, "View assessment")}
  ${resumeLink ? btnLink(resumeLink, "View resume", "link") : ""}

  ${paragraph("This is an automated notification from Skill Bridge.")}
  `;
}