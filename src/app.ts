import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { StripeController } from "./controllers/stripe.controller";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import assessmentsRoutes from "./routes/assessments.routes";
import calendarRoutes from "./routes/calendar.routes";
import cloudinaryRoutes from "./routes/cloudinary.routes";
import emailsRoutes from "./routes/emails.routes";
import s3Routes from "./routes/s3.routes";
import stripeRoutes from "./routes/stripe.routes";
import publicRoutes from "./routes/public.routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: [env.frontendUrl],
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Stripe-Signature"],
    }),
  );

  // Must use raw body for Stripe signature verification — before express.json()
  app.post(
    "/stripe/webhook",
    express.raw({ type: "application/json" }),
    (req, res, next) => StripeController.webhook(req, res, next),
  );

  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ 
      name:"Skill Bridge",
      version:"1.0.0",
     });
  });

  app.use("/services/s3", s3Routes);
  app.use("/services/emails", emailsRoutes);
  app.use("/services/calendar", calendarRoutes);
  app.use("/cloudinary", cloudinaryRoutes);
  app.use("/assessments", assessmentsRoutes);
  // app.use("/stripe", stripeRoutes); //unused
  app.use("/public", publicRoutes); //working perfectly
  app.use(notFoundHandler)
  app.use(errorHandler);

  return app;
}
