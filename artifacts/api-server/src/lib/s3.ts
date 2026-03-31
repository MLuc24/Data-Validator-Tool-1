import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env["S3_ENDPOINT"];
const region = process.env["S3_REGION"] ?? "ap-southeast-2";
const accessKeyId = process.env["S3_ACCESS_KEY_ID"];
const secretAccessKey = process.env["S3_SECRET_ACCESS_KEY"];

if (!accessKeyId || !secretAccessKey) {
  throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set");
}

export const s3Client = new S3Client({
  ...(endpoint ? { endpoint } : {}),
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

export const S3_BUCKET = process.env["S3_BUCKET"] ?? "KeToan";
