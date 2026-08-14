import { env } from "../config/env";
import {
  contactUsNotificationToAdmin,
  contactUsThankYouToUser,
} from "../email-templates/contact-us";
import { ContactMessageModel } from "../models/contact-message.model";
import { createContactMessageId } from "../utils/id";
import { sendEmail } from "./email.service";

export type ContactUsInput = {
  name: string;
  email: string;
  phone: string;
  livesInUk: boolean;
  currentVisa?: string;
  prefered: "phone" | "google_meet";
  subject: string;
  message: string;
};

export const ContactService = {
  async submit(input: ContactUsInput): Promise<{ message: string }> {
    await ContactMessageModel.create({
      id: createContactMessageId(),
      name: input.name,
      email: input.email,
      phone: input.phone,
      livesInUk: input.livesInUk,
      currentVisa: input.currentVisa ?? null,
      prefered: input.prefered,
      subject: input.subject,
      message: input.message,
    });

    const templateInput = {
      name: input.name,
      email: input.email,
      phone: input.phone,
      livesInUk: input.livesInUk,
      currentVisa: input.currentVisa,
      prefered: input.prefered,
      subject: input.subject,
      message: input.message,
    };

    await sendEmail({
      to: input.email,
      subject: `Re: ${input.subject.trim()}`,
      body: contactUsThankYouToUser(templateInput),
    });

    if (env.admin.email.trim()) {
      await sendEmail({
        to: env.admin.email,
        subject: `New contact enquiry: ${input.subject.trim() || "No subject"}`,
        body: contactUsNotificationToAdmin(templateInput),
      });
    }

    return {
      message:
        "Thanks for reaching out. We’ll get back to you within five business day.",
    };
  },
};
