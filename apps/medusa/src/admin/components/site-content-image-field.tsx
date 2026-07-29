import { useRef, useState } from "react";
import { Button, toast } from "@medusajs/ui";
import { Photo } from "@medusajs/icons";

import { sdk } from "../lib/client";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type SiteContentImageFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

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
      const { files } = await sdk.admin.upload.create({ files: [file] });
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
