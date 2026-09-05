import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const STAGING_PREFIX = "staging";
export const ARTWORK_PREFIX = "artwork";

export const MIN_SIGNED_URL_SECONDS = 60;
export const MAX_SIGNED_URL_SECONDS = 3600;
export const DEFAULT_SIGNED_URL_SECONDS = 300;

export type ArtworkStorageOptions = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export class ArtworkStorageNotConfiguredError extends Error {
  constructor(missing: readonly string[]) {
    super(`Artwork storage is not configured: missing ${missing.join(", ")}`);
    this.name = "ArtworkStorageNotConfiguredError";
  }
}

export class UnsafeArtworkKeyPartError extends Error {
  constructor(part: string) {
    super(`Refusing to build an artwork key from ${JSON.stringify(part)}`);
    this.name = "UnsafeArtworkKeyPartError";
  }
}

export function readArtworkStorageOptions(
  env: NodeJS.ProcessEnv = process.env,
): ArtworkStorageOptions {
  const values = {
    endpoint: env.ARTWORK_STORAGE_ENDPOINT,
    region: env.ARTWORK_STORAGE_REGION ?? "auto",
    bucket: env.ARTWORK_STORAGE_BUCKET,
    accessKeyId: env.ARTWORK_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.ARTWORK_STORAGE_SECRET_ACCESS_KEY,
  };

  const missing = Object.entries(values)
    .filter(([, value]) => value == null || value === "")
    .map(([key]) => key);

  if (missing.length > 0) throw new ArtworkStorageNotConfiguredError(missing);

  return {
    endpoint: values.endpoint as string,
    region: values.region,
    bucket: values.bucket as string,
    accessKeyId: values.accessKeyId as string,
    secretAccessKey: values.secretAccessKey as string,
    forcePathStyle: env.ARTWORK_STORAGE_FORCE_PATH_STYLE !== "false",
  };
}

function safePart(part: string): string {
  if (
    part === "" ||
    part.startsWith(".") ||
    part.includes("/") ||
    part.includes("\\")
  ) {
    throw new UnsafeArtworkKeyPartError(part);
  }

  return part;
}

export function stagingObjectKey(uploadId: string, extension: string): string {
  return `${STAGING_PREFIX}/${safePart(uploadId)}.${safePart(extension)}`;
}

export function artworkObjectKey(
  orderId: string,
  lineItemId: string,
  uploadId: string,
  extension: string,
): string {
  return `${ARTWORK_PREFIX}/${safePart(orderId)}/${safePart(lineItemId)}/${safePart(uploadId)}.${safePart(extension)}`;
}

export function clampExpiry(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_SIGNED_URL_SECONDS;

  return Math.min(
    MAX_SIGNED_URL_SECONDS,
    Math.max(MIN_SIGNED_URL_SECONDS, Math.trunc(seconds)),
  );
}

export function readUploadUrlTtlSeconds(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.ARTWORK_UPLOAD_URL_TTL_SECONDS;
  if (raw == null || raw === "") return DEFAULT_SIGNED_URL_SECONDS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_SIGNED_URL_SECONDS;

  return clampExpiry(parsed);
}

let client: S3Client | null = null;
let clientOptions: ArtworkStorageOptions | null = null;

function s3(options: ArtworkStorageOptions): S3Client {
  if (client && clientOptions?.endpoint === options.endpoint) return client;

  client = new S3Client({
    endpoint: options.endpoint,
    region: options.region,
    forcePathStyle: options.forcePathStyle,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
  });
  clientOptions = options;

  return client;
}

export async function presignArtworkUpload(
  input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds?: number;
  },
  options: ArtworkStorageOptions = readArtworkStorageOptions(),
): Promise<string> {
  return getSignedUrl(
    s3(options),
    new PutObjectCommand({
      Bucket: options.bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    }),
    {
      expiresIn: clampExpiry(
        input.expiresInSeconds ?? DEFAULT_SIGNED_URL_SECONDS,
      ),
    },
  );
}

export async function presignArtworkDownload(
  input: { key: string; fileName: string; expiresInSeconds?: number },
  options: ArtworkStorageOptions = readArtworkStorageOptions(),
): Promise<string> {
  return getSignedUrl(
    s3(options),
    new GetObjectCommand({
      Bucket: options.bucket,
      Key: input.key,
      ResponseContentDisposition: contentDisposition(input.fileName),
    }),
    {
      expiresIn: clampExpiry(
        input.expiresInSeconds ?? DEFAULT_SIGNED_URL_SECONDS,
      ),
    },
  );
}

export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function headArtwork(
  key: string,
  options: ArtworkStorageOptions = readArtworkStorageOptions(),
): Promise<{ sizeBytes: number }> {
  const result = await s3(options).send(
    new HeadObjectCommand({ Bucket: options.bucket, Key: key }),
  );

  return { sizeBytes: result.ContentLength ?? 0 };
}

export async function copyArtwork(
  fromKey: string,
  toKey: string,
  options: ArtworkStorageOptions = readArtworkStorageOptions(),
): Promise<void> {
  await s3(options).send(
    new CopyObjectCommand({
      Bucket: options.bucket,
      Key: toKey,
      CopySource: `${options.bucket}/${fromKey}`
        .split("/")
        .map(encodeURIComponent)
        .join("/"),
    }),
  );
}

export async function deleteArtwork(
  key: string,
  options: ArtworkStorageOptions = readArtworkStorageOptions(),
): Promise<void> {
  await s3(options).send(
    new DeleteObjectCommand({ Bucket: options.bucket, Key: key }),
  );
}

export function __resetForTests(): void {
  client = null;
  clientOptions = null;
}
