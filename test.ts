
import { sendEmail } from "./src/services/email.service";
(async () => {
  try {
    await sendEmail({
      to: "mitime9976@rpaintel.com",
      subject: "Test Email Email for Admins",
      body: "This is a test email",
    });
  } catch (error) {
    console.error(error);
  }
})();

