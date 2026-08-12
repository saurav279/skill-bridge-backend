import { Router } from "express";
import { AssessmentsController } from "../controllers/assessments.controller";

const router = Router();

router.post("/", (req, res, next) =>
  AssessmentsController.create(req, res, next),
);
router.get("/:id", (req, res, next) =>
  AssessmentsController.getById(req, res, next),
);

export default router;
