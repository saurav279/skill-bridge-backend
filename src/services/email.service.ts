import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "../utils/errors";



function createTransport() {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    throw new AppError(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.",
      500,
    );
  }

  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });
}



export async function sendEmail(
 {subject, body, to}: {subject: string, body: string, to: string}
): Promise<void> {
  const transport = createTransport();
  // console.log({
  //   from: env.smtp.from,
  //   to,
  //   subject,
  //   text: body,
  // })


  try {
    await transport.sendMail({
      from: env.smtp.from,
      to,
      subject,
      text: body,
    });
  } catch (error) {
    console.log(error);
    throw new AppError(
      `Failed to send assessment email: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      500,
    );
  }
}
