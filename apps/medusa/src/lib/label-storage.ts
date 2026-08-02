import {
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type LabelStorageOptions = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export class LabelStorageNotConfiguredError extends Error {
  constructor(missing: readonly string[]) {
    super(`Label storage is not configured: missing ${missing.join(", ")}`);
    this.name = "LabelStorageNotConfiguredError";
  }
}

export function readLabelStorageOptions(
  env: NodeJS.ProcessEnv = process.env,
): LabelStorageOptions {
  const values = {
    endpoint: env.LABEL_STORAGE_ENDPOINT,
    region: env.LABEL_STORAGE_REGION ?? "auto",
    bucket: env.LABEL_STORAGE_BUCKET,
    accessKeyId: env.LABEL_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.LABEL_STORAGE_SECRET_ACCESS_KEY,
  };

  const missing = Object.entries(values)
    .filter(([, value]) => value == null || value === "")
    .map(([key]) => key);

  if (missing.length > 0) throw new LabelStorageNotConfiguredError(missing);

  return {
    endpoint: values.endpoint as string,
    region: values.region,
    bucket: values.bucket as string,
    accessKeyId: values.accessKeyId as string,
    secretAccessKey: values.secretAccessKey as string,
    forcePathStyle: env.LABEL_STORAGE_FORCE_PATH_STYLE !== "false",
  };
}

export function labelObjectKey(orderId: string, uuid: string): string {
  return `labels/${orderId}/${uuid}.pdf`;
}

let client: S3Client | null = null;
let clientOptions: LabelStorageOptions | null = null;

function s3(options: LabelStorageOptions): S3Client {
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

export async function putLabel(
  key: string,
  bytes: Buffer,
  options: LabelStorageOptions = readLabelStorageOptions(),
): Promise<void> {
  await s3(options).send(
    new PutObjectCommand({
      Bucket: options.bucket,
      Key: key,
      Body: bytes,
      ContentType: "application/pdf",
    }),
  );
}

export async function getLabel(
  key: string,
  options: LabelStorageOptions = readLabelStorageOptions(),
): Promise<Buffer> {
  const result = await s3(options).send(
    new GetObjectCommand({ Bucket: options.bucket, Key: key }),
  );

  if (!result.Body) {
    throw new Error(`Label ${key} came back with no body`);
  }

  return Buffer.from(await result.Body.transformToByteArray());
}

export async function deleteLabel(
  key: string,
  options: LabelStorageOptions = readLabelStorageOptions(),
): Promise<void> {
  await s3(options).send(
    new DeleteObjectCommand({ Bucket: options.bucket, Key: key }),
  );
}

export function __resetForTests(): void {
  client = null;
  clientOptions = null;
}
