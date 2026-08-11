import type { Request, Response, NextFunction } from "express";
import { CloudinaryService } from "../services/cloudinary.service";
import { ValidationError } from "../utils/errors";

export const CloudinaryController = {
  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        throw new ValidationError('File field "file" is required');
      }

      const result = await CloudinaryService.upload({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },
};
