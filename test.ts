
import { sendEmail } from "./src/services/email.service";
import { stripePaymentSuccessToAdmin } from "./src/email-templates/stripe";
(async () => {
  try {
    const template = stripePaymentSuccessToAdmin({
      customerName: "John Doe",
      customerEmail: "john.doe@example.com",
      packageName: "Package A",
      packagePrice: 100,
    });

    await sendEmail({
      to: "mitime9976@rpaintel.com",
      subject: "Test Email Email for Admins",
      body: template,
    });
  } catch (error) {
    console.error(error);
  }
})();

