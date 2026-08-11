import { Router } from "express";
import multer from "multer";
import { env } from "../config/env";
import { CloudinaryController } from "../controllers/cloudinary.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.cloudinary.maxUploadBytes,
  },
});

const router = Router();

router.post("/upload", upload.single("file"), (req, res, next) =>
  CloudinaryController.upload(req, res, next),
);

export default router;
