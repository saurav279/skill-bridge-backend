import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";
import { env } from "../config/env";
import {
  consultationNotificationToAdmin,
  consultationThankYouToUser,
} from "../email-templates/consultation";
import { ConsultationModel } from "../models/consultation.model";
import { createConsultationId } from "../utils/id";
import { AppError, ValidationError } from "../utils/errors";
import { intakeSchema } from "../utils/intake";
import { sendEmail } from "./email.service";
import { sanitizePackageName } from "../types/packages";
import type { PackageName } from "../types/packages";
import crypto from "crypto";

const PRIMARY_CALENDAR_ID = "primary";
const IMPERSONATED_USER = "contact@skillbridgeconsultants.com";

/** Change these to adjust the booking window later. */
export const SLOT_WINDOW = {
  timeZone: "Europe/London",
  startHour: 9,
  endHour: 17,
  slotMinutes: 15,
  minNoticeHours: 24,
} as const;

const addCalendarSchema = z
  .object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().trim().email("A valid email is required"),
    description: z.string().trim().min(1, "Description is required"),
    packageName: z.string().trim().min(1, "Package name is required"),
    price: z.number().int().nonnegative("Price must be a non-negative integer"),
    stripeSessionId: z.string().trim().min(1).optional().nullable(),
    stripePaymentIntentId: z.string().trim().min(1).optional().nullable(),
  })
  .and(intakeSchema)
  .refine((value) => value.endTime > value.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export type CreateCalendarEventInput = {
  startTime: Date | string;
  endTime: Date | string;
  name: string;
  email: string;
  description: string;
  packageName: string;
};

export type CreateCalendarEventResult = {
  eventId: string;
  htmlLink: string;
};

export type AddCalendarInput = CreateCalendarEventInput & {
  packageName: string;
  price: number;
  phone: string;
  livesInUk: boolean;
  currentVisa?: string;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
};

export type AddCalendarResult = {
  consultationId: string;
  htmlLink: string;
};

export type AvailableSlot = {
  label: string;
  startTime: string;
  endTime: string;
};

export type AvailableSlotsResult = {
  date: string;
  timeZone: string;
  slotMinutes: number;
  slots: AvailableSlot[];
};

function getCalendarClient(): {
  calendar: calendar_v3.Calendar;
  timeZone: string;
} {
  const { clientEmail, privateKey, timeZone } = env.google.calendar;

  if (!clientEmail || !privateKey) {
    throw new AppError(
      "Google Calendar is not configured. Set GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
      500,
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: IMPERSONATED_USER,
  });

  return {
    calendar: google.calendar({ version: "v3", auth }),
    timeZone,
  };
}

function toDate(value: Date | string, field: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} is not a valid date`);
  }
  return date;
}

function calendarApiError(error: unknown, fallback: string): AppError {
  const message =
    error instanceof Error && error.message ? error.message : fallback;
  return new AppError(`Google Calendar error: ${message}`, 500);
}

function resolveFreeBusy(
  calendars: calendar_v3.Schema$FreeBusyResponse["calendars"],
): calendar_v3.Schema$FreeBusyCalendar | undefined {
  return calendars?.[IMPERSONATED_USER] ?? calendars?.[PRIMARY_CALENDAR_ID];
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatSlotLabel(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): string {
  return `${startHour}:${pad2(startMinute)} - ${endHour}:${pad2(endMinute)}`;
}

function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseDateParts(date: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new ValidationError("date must be YYYY-MM-DD");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new ValidationError("date must be a valid calendar date (YYYY-MM-DD)");
  }

  return { year, month, day };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );

  return asUtc - date.getTime();
}

function zonedLocalToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const first = new Date(asUtc - getTimeZoneOffsetMs(new Date(asUtc), timeZone));
  return new Date(asUtc - getTimeZoneOffsetMs(first, timeZone));
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function overlaps(
  start: Date,
  end: Date,
  busyStart: Date,
  busyEnd: Date,
): boolean {
  return start < busyEnd && end > busyStart;
}

async function getBusyPeriods(
  start: Date,
  end: Date,
): Promise<Array<{ start: Date; end: Date }>> {
  const { calendar, timeZone } = getCalendarClient();

  let data: calendar_v3.Schema$FreeBusyResponse;
  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        timeZone,
        items: [{ id: IMPERSONATED_USER }, { id: PRIMARY_CALENDAR_ID }],
      },
    });
    data = response.data;
  } catch (error) {
    throw calendarApiError(error, "failed to check calendar availability");
  }

  const calendarBusy = resolveFreeBusy(data.calendars);
  if (calendarBusy?.errors?.length) {
    const detail = calendarBusy.errors
      .map((item) => item.reason ?? item.domain)
      .filter(Boolean)
      .join(", ");
    const notFound = calendarBusy.errors.some(
      (item) => item.reason === "notFound",
    );
    throw new AppError(
      notFound
        ? `Primary calendar was not found for ${IMPERSONATED_USER}. Confirm domain-wide delegation for this user.`
        : `Google Calendar availability check failed${detail ? `: ${detail}` : ""}`,
      500,
    );
  }

  return (calendarBusy?.busy ?? [])
    .filter((block) => block.start && block.end)
    .map((block) => ({
      start: new Date(block.start as string),
      end: new Date(block.end as string),
    }));
}

async function deleteEvent(eventId: string): Promise<void> {
  const { calendar } = getCalendarClient();
  await calendar.events.delete({
    calendarId: PRIMARY_CALENDAR_ID,
    eventId,
    sendUpdates: "all",
  });
}

export const CalendarService = {
  async isTimeSlotBooked(
    startTime: Date | string,
    endTime: Date | string,
  ): Promise<boolean> {
    const start = toDate(startTime, "startTime");
    const end = toDate(endTime, "endTime");

    if (end <= start) {
      throw new ValidationError("End time must be after start time");
    }

    const busy = await getBusyPeriods(start, end);
    return busy.length > 0;
  },

  async getAvailableSlots(
    date?: string,
    difference?: number,
  ): Promise<AvailableSlotsResult> {
    const { timeZone, startHour, endHour, slotMinutes: defaultSlotMinutes, minNoticeHours } =
      SLOT_WINDOW;
    const slotMinutes = difference ?? defaultSlotMinutes;
    const day = date?.trim() ? date.trim() : todayInTimeZone(timeZone);
    const { year, month, day: monthDay } = parseDateParts(day);

    const windowStart = zonedLocalToUtc(
      timeZone,
      year,
      month,
      monthDay,
      startHour,
      0,
    );
    const windowEnd = zonedLocalToUtc(
      timeZone,
      year,
      month,
      monthDay,
      endHour,
      0,
    );

    const busy = await getBusyPeriods(windowStart, windowEnd);
    const earliestStart = addMinutes(new Date(), minNoticeHours * 60);
    const slots: AvailableSlot[] = [];

    for (
      let cursor = new Date(windowStart);
      cursor < windowEnd;
      cursor = addMinutes(cursor, slotMinutes)
    ) {
      const slotEnd = addMinutes(cursor, slotMinutes);
      if (slotEnd > windowEnd) {
        break;
      }
      if (cursor < earliestStart) {
        continue;
      }
      if (busy.some((block) => overlaps(cursor, slotEnd, block.start, block.end))) {
        continue;
      }

      const startParts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(cursor);
      const endParts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(slotEnd);

      const startH = Number(startParts.find((part) => part.type === "hour")?.value);
      const startM = Number(
        startParts.find((part) => part.type === "minute")?.value,
      );
      const endH = Number(endParts.find((part) => part.type === "hour")?.value);
      const endM = Number(endParts.find((part) => part.type === "minute")?.value);

      slots.push({
        label: formatSlotLabel(startH, startM, endH, endM),
        startTime: cursor.toISOString(),
        endTime: slotEnd.toISOString(),
      });
    }

    return { date: day, timeZone, slotMinutes, slots };
  },

  async createEvent(
    input: CreateCalendarEventInput,
  ): Promise<CreateCalendarEventResult> {
    const start = toDate(input.startTime, "startTime");
    const end = toDate(input.endTime, "endTime");
    const name = input.name?.trim();
    const email = input.email?.trim();
    const description = input.description?.trim();

    if (!name) {
      throw new ValidationError("Name is required");
    }
    if (!email) {
      throw new ValidationError("Email is required");
    }
    if (!description) {
      throw new ValidationError("Description is required");
    }
    if (end <= start) {
      throw new ValidationError("End time must be after start time");
    }

    const { calendar, timeZone } = getCalendarClient();

    try {
      const { data } = await calendar.events.insert({
        calendarId: PRIMARY_CALENDAR_ID,
        conferenceDataVersion: 1,
        sendUpdates: "all",
        requestBody: {
          summary: `Package: ${input.packageName} | ${name}`,
          description,
          start: {
            dateTime: start.toISOString(),
            timeZone,
          },
          end: {
            dateTime: end.toISOString(),
            timeZone,
          },
          attendees: [{ email, displayName: name }, { email: "contact@skillbridgeconsultants.com", displayName: "Skill Bridge Consultants" }],
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: {
                type: "hangoutsMeet",
              },
            },
          },
        },
      });

      if (!data.id || !data.htmlLink) {
        throw new AppError("Google Calendar did not return an event link", 500);
      }

      return { eventId: data.id, htmlLink: data.htmlLink };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw calendarApiError(error, "failed to create calendar event");
    }
  },

  async addCalendar(input: AddCalendarInput): Promise<AddCalendarResult> {
    const parsed = addCalendarSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ValidationError(first?.message ?? "Invalid calendar booking");
    }

    const {
      startTime,
      endTime,
      name,
      email,
      phone,
      livesInUk,
      currentVisa,
      description,
      packageName,
      price,
      stripeSessionId,
      stripePaymentIntentId,
    } = parsed.data;

    const booked = await CalendarService.isTimeSlotBooked(startTime, endTime);
    if (booked) {
      throw new ValidationError("This time slot is already booked");
    }

    const event = await CalendarService.createEvent({
      startTime,
      endTime,
      name,
      email,
      description,
      packageName:sanitizePackageName(packageName as PackageName)
    });

    try {
      const consultation = await ConsultationModel.create({
        id: createConsultationId(),
        name,
        email,
        phone,
        livesInUk,
        currentVisa: currentVisa ?? null,
        startTime,
        endTime,
        packageName,
        price,
        calendarEventId: event.eventId,
        stripeSessionId: stripeSessionId ?? null,
        stripePaymentIntentId: stripePaymentIntentId ?? null,
      });

      const emailInput = {
        name,
        email,
        phone,
        livesInUk,
        currentVisa,
        description,
        packageName:sanitizePackageName(packageName as PackageName),
        price,
        startTime,
        endTime,
        timeZone: SLOT_WINDOW.timeZone,
        htmlLink: event.htmlLink,
      };

      try {
        await sendEmail({
          to: email,
          subject: `Your Package ${emailInput.packageName} is purchased and initial call booked`,
          body: consultationThankYouToUser(emailInput),
        });

        if (env.admin.email.trim()) {
          await sendEmail({
            to: env.admin.email,
            subject: `New Package ${emailInput.packageName} is purchased and initial call booked : ${name}`,
            body: await consultationNotificationToAdmin(emailInput),
          });
        }
      } catch (error) {
        console.error("Consultation booking email failed:", error);
      }

      return {
        consultationId: consultation.id,
        htmlLink: event.htmlLink,
      };
    } catch (error) {
      try {
        await deleteEvent(event.eventId);
      } catch {
        // Event exists in Google even if local persist failed.
      }
      throw error;
    }
  },
};

export const addCalendar = CalendarService.addCalendar;
