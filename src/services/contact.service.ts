import { env } from "../config/env";
import {
  contactUsNotificationToAdmin,
  contactUsThankYouToUser,
} from "../email-templates/contact-us";
import { ContactMessageModel } from "../models/contact-message.model";
import { LeadModel } from "../models/lead.model";
import { NoteModel } from "../models/note.model";
import { PipelineModel } from "../models/pipeline.model";
import { createContactMessageId, createLeadId, createNoteId, createPipelineId } from "../utils/id";
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

        //create 
        const lead = await LeadModel.create({
          id: createLeadId(),
          email: input.email ?? "",
          name: input.name ?? "",
          phone: input.phone ?? "",
          priority: "High",
        });
        if (lead.id) {
          await NoteModel.create({
            id: createNoteId(),
            leadId: lead.id,
            note: `Contact Enquiry: ${input.subject.trim()}`,
            notedBy: "System",
          });
          const status = input.subject.includes("Discovery Call") ? "Discovery Call Scheduled" : "Contact Enquiry";
          await PipelineModel.create({
            id: createPipelineId(),
            leadId: lead.id,
            status: status,
          });
        }

    await sendEmail({
      to: input.email,
      subject: `Re: ${input.subject.trim()}`,
      body: contactUsThankYouToUser(templateInput),
    });

    if (env.admin.email.trim()) {
      await sendEmail({
        to: env.admin.email,
        subject: `New contact enquiry: ${input.subject.trim() || "No subject"}`,
        body: await contactUsNotificationToAdmin(templateInput),
      });
    }

    return {
      message:
        "Thanks for reaching out. We’ll get back to you within five business day.",
    };
  },
};
