import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "../../utils/logger";

export class StorageService {
  private s3: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucket = process.env.R2_BUCKET_NAME || "omnichat";
    this.publicUrl = process.env.R2_PUBLIC_URL || "";

    if (!accountId || !accessKeyId || !secretAccessKey) {
      logger.warn("R2 credentials missing. Storage service disabled.");
      // Mock client to prevent crashes, but uploads will fail
      this.s3 = new S3Client({ region: "auto" });
      return;
    }

    this.s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadFile(
    key: string,
    body: Buffer | Uint8Array | Blob | string,
    contentType: string
  ): Promise<string> {
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        })
      );

      if (this.publicUrl) {
        return `${this.publicUrl}/${key}`;
      }
      
      // Fallback to presigned URL if no public domain configured
      // Note: R2 presigned URLs might need custom domain setup for best results
      return await this.getPresignedUrl(key);
    } catch (error) {
      logger.error({ error, key }, "Failed to upload file to R2");
      throw error;
    }
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    // Note: For R2, you might want to use a custom domain or worker
    // This generates a standard S3 presigned URL
    // const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    // return getSignedUrl(this.s3, command, { expiresIn });
    
    // If public URL is set, just return that
    if (this.publicUrl) {
        return `${this.publicUrl}/${key}`;
    }
    return "";
  }
}

export const storageService = new StorageService();
