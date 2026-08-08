import { Router } from "express";
import multer from "multer";
import { env } from "../config/env";
import { S3Controller } from "../controllers/s3.controller";
import { ValidationError } from "../utils/errors";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.aws.maxUploadBytes,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new ValidationError("Only PDF uploads are supported"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/upload", upload.single("file"), (req, res, next) =>
  S3Controller.upload(req, res, next),
);

export default router;
