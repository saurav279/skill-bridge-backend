import { Router } from "express";
import { PublicController } from "../controllers/public.controller";

const router = Router();

router.post("/contact-us", (req, res, next) =>
  PublicController.contactUs(req, res, next),
);

export default router;
