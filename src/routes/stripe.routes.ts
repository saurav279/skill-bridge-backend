import { Router } from "express";
import { StripeController } from "../controllers/stripe.controller";

const router = Router();

router.post("/checkout", (req, res, next) =>
  StripeController.createCheckout(req, res, next),
);

export default router;
