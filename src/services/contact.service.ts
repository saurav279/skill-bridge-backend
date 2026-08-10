import { contactThankYouTemplate } from "../controllers/emails.controller";
import { ContactMessageModel } from "../models/contact-message.model";
import { createContactMessageId } from "../utils/id";
import { sendEmail } from "./email.service";

export type ContactUsInput = {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
};

export const ContactService = {
  async submit(
    input: ContactUsInput,
  ): Promise<{ message: string }> {
    await ContactMessageModel.create({
      id: createContactMessageId(),
      name: input.name,
      email: input.email,
      company: input.company,
      subject: input.subject,
      message: input.message,
    });

    await sendEmail({
      to: input.email,
      subject: "Thank you for contacting Skill Bridge",
      body: contactThankYouTemplate({ name: input.name }),
    });

    return { message: "Thanks for reaching out. We’ll get back to you within one business day." };
  },
};
