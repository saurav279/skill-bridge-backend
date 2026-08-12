import { Router } from "express";
import { AssessmentsController } from "../controllers/assessments.controller";
import { EmailsController } from "../controllers/emails.controller";

const router = Router();

router.post("/unsubscribe", (req, res, next) =>
  EmailsController.unsubscribe(req, res, next),
);
router.post("/subscribe", (req, res, next) =>
  EmailsController.subscribe(req, res, next),
);
router.post("/assessments/:id", (req, res, next) =>
  AssessmentsController.email(req, res, next),
);

export default router;
