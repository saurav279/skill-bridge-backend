
import { sendEmail } from "./src/services/email.service";
import { AssessmentService } from "./src/services/assessment.service";
import { assessmentEmailTemplate } from "./src/email-templates/assessment";
(async () => {
  try {
    const assessment = await AssessmentService.getById("ea_01KZT0ZHV1JHMBSTH8BF6V0WK7");
    const template = assessmentEmailTemplate(assessment);

    await sendEmail({
      to: "mitime9976@rpaintel.com",
      subject: "Test Email Email for Admins",
      body: template,
    });
  } catch (error) {
    console.error(error);
  }
})();

