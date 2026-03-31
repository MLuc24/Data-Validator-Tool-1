import { Router } from "express";
import multer from "multer";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "../lib/s3";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

router.post("/storage/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `uploads/${timestamp}_${safeName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: storagePath,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    res.json({
      storagePath,
      bucket: S3_BUCKET,
      mime_type: file.mimetype,
      file_size_bytes: file.size,
      stored_file_name: file.originalname,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    res.status(500).json({ error: message });
  }
});

router.post("/storage/download-url", async (req, res) => {
  try {
    const { storagePath, bucket } = req.body as {
      storagePath: string;
      bucket?: string;
    };

    if (!storagePath) {
      res.status(400).json({ error: "storagePath is required" });
      return;
    }

    const command = new GetObjectCommand({
      Bucket: bucket ?? S3_BUCKET,
      Key: storagePath,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    res.json({ signedUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate download URL";
    res.status(500).json({ error: message });
  }
});

export default router;
