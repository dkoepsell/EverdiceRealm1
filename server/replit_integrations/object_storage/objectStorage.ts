import * as fs from "fs";
import * as path from "path";
import { createReadStream, existsSync } from "fs";
import { randomUUID } from "crypto";
import { Response } from "express";
import type { ObjectAclPolicy } from "./objectAcl";
import { ObjectPermission } from "./objectAcl";

const uploadsDir = path.resolve(process.env.LOCAL_UPLOADS_DIR || "uploads");

// Local filesystem client with GCS-compatible bucket/file interface.
// Callers use: objectStorageClient.bucket(id).file(path).save(buffer, opts)
export const objectStorageClient = {
  bucket(_bucketId: string) {
    return {
      file(filePath: string) {
        const localPath = path.join(uploadsDir, filePath);
        return {
          async save(buffer: Buffer, _opts?: Record<string, unknown>) {
            await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
            await fs.promises.writeFile(localPath, buffer);
          },
          async exists(): Promise<[boolean]> {
            return [existsSync(localPath)];
          },
          createReadStream() {
            return createReadStream(localPath);
          },
          async getMetadata() {
            const stat = existsSync(localPath)
              ? await fs.promises.stat(localPath)
              : null;
            return [{ size: stat?.size ?? 0, contentType: "image/png" }];
          },
        };
      },
    };
  },
};

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  private getUploadsDir(): string {
    return uploadsDir;
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    return `/api/uploads/local/${objectId}`;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/api/uploads/local/")) {
      const objectId = rawPath.replace("/api/uploads/local/", "");
      return `/objects/private/uploads/${objectId}`;
    }
    return rawPath;
  }

  async getObjectEntityFile(objectPath: string): Promise<string> {
    // objectPath is like "/objects/private/uploads/uuid" or "/objects/avatars/uuid.png"
    const stripped = objectPath.replace(/^\/objects\//, "");
    const localPath = path.join(this.getUploadsDir(), stripped);
    if (!existsSync(localPath)) throw new ObjectNotFoundError();
    return localPath;
  }

  async downloadObject(localFilePath: string, res: Response, _cacheTtlSec = 3600) {
    if (!existsSync(localFilePath)) {
      if (!res.headersSent) res.status(404).json({ error: "File not found" });
      return;
    }
    res.sendFile(path.resolve(localFilePath));
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    _aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(_opts: {
    userId?: string;
    objectFile: string;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return true;
  }

  async uploadPublicFile(localFilePath: string, destFileName: string): Promise<string> {
    const destPath = path.join(this.getUploadsDir(), "public", destFileName);
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    await fs.promises.copyFile(localFilePath, destPath);
    return `/api/public-assets/${destFileName}`;
  }
}
