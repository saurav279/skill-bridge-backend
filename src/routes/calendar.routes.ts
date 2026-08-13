import { Router } from "express";
import { CalendarController } from "../controllers/calendar.controller";

const router = Router();

router.get("/available-slots", (req, res, next) =>
  CalendarController.availableSlots(req, res, next),
);
router.post("/stripe", (req, res, next) =>
  CalendarController.createStripeCheckout(req, res, next),
);
router.post("/free", (req, res, next) =>
  CalendarController.bookFree(req, res, next),
);

export default router;
