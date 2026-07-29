import { useRef, useState } from "react";
import { Button, toast } from "@medusajs/ui";
import { Photo } from "@medusajs/icons";

import { sdk } from "../lib/client";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2000;
const RESIZED_JPEG_QUALITY = 0.82;

type SiteContentImageFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

async function resizeImage(file: File): Promise<File> {
  if (file.type === "image/svg+xml") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  if (scale === 1) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", RESIZED_JPEG_QUALITY),
  );
  if (!blob) {
    return file;
  }

  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

export function SiteContentImageField({
  id,
  value,
  onChange,
}: SiteContentImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Images must be under 5 MB");
      return;
    }

    setIsUploading(true);
    try {
      const resized = await resizeImage(file);
      const { files } = await sdk.admin.upload.create({ files: [resized] });
      const uploaded = files[0];
      if (!uploaded) {
        throw new Error("Upload returned no file");
      }
      onChange(uploaded.url);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not upload the image",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-x-3">
      <div className="bg-ui-bg-subtle border-ui-border-base flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border">
        {value ? (
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <Photo className="text-ui-fg-muted" />
        )}
      </div>

      <div className="flex flex-col gap-y-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-x-2">
          <Button
            type="button"
            variant="secondary"
            size="small"
            isLoading={isUploading}
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {value ? "Replace" : "Upload"}
          </Button>
          {value ? (
            <Button
              type="button"
              variant="transparent"
              size="small"
              onClick={() => onChange("")}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
