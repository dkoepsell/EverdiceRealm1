import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import type { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

const uploadsDir = path.resolve(process.env.LOCAL_UPLOADS_DIR || "uploads");

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dest = path.join(uploadsDir, "private", "uploads");
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  }),
});

export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  // Request a local upload slot; client receives a PUT URL
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath, metadata: req.body });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Accept multipart file uploads from the Uppy client
  app.post("/api/uploads/local/:objectId", upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const objectPath = `/objects/private/uploads/${req.params.objectId}`;
      // Move/rename to the expected path
      const destPath = path.join(uploadsDir, "private", "uploads", req.params.objectId);
      fs.renameSync(req.file.path, destPath);
      res.json({ objectPath });
    } catch (error) {
      console.error("Error handling local upload:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Serve AI-generated public assets (portraits, covers, avatars, etc.)
  app.get("/api/public-assets/:assetPath(*)", (req, res) => {
    const assetPath = req.params.assetPath;
    const localPath = path.resolve(path.join(uploadsDir, "public", assetPath));

    // Prevent directory traversal
    if (!localPath.startsWith(path.resolve(uploadsDir))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ error: "Asset not found" });
    }

    res.set("Cache-Control", "public, max-age=31536000");
    res.sendFile(localPath);
  });

  // Serve private/uploaded objects
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectPath = req.params.objectPath;

      // Try public path first (portraits, avatars, etc. are stored as public/xxx/uuid.png)
      const publicPath = path.resolve(path.join(uploadsDir, "public", objectPath));
      if (
        publicPath.startsWith(path.resolve(uploadsDir)) &&
        fs.existsSync(publicPath)
      ) {
        res.set("Cache-Control", "public, max-age=31536000");
        return res.sendFile(publicPath);
      }

      // Fall back to private storage
      const localPath = await objectStorageService.getObjectEntityFile(
        `/objects/${objectPath}`
      );
      await objectStorageService.downloadObject(localPath, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      console.error("Error serving object:", error);
      res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
