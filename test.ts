
import { sendEmail } from "./src/services/email.service";
(async () => {
  try {
    await sendEmail({
      to: "markapture2003@gmail.com,sauravpandey0325@gmail.com",
      subject: "Test Email Email for Admins",
      body: "This is a test email",
    });
  } catch (error) {
    console.error(error);
  }
})();

