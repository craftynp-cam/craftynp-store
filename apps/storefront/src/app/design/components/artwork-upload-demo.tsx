"use client";

import { useState } from "react";

import { ArtworkUpload } from "@/components";
import { ArtworkUploadError } from "@/lib/artwork-upload";
import type { ArtworkReference, UploadArtwork } from "@/lib/artwork-upload";

const PROGRESS_STEP_MS = 180;
const PROGRESS_STEPS = 12;

const simulatedUpload: UploadArtwork = ({ file, signal, onProgress }) =>
  new Promise((resolve, reject) => {
    let step = 0;

    const timer = setInterval(() => {
      if (signal?.aborted) {
        clearInterval(timer);
        reject(new ArtworkUploadError("aborted"));
        return;
      }

      step += 1;
      onProgress?.({
        loaded: Math.round((file.size * step) / PROGRESS_STEPS),
        total: file.size,
        fraction: step / PROGRESS_STEPS,
      });

      if (step < PROGRESS_STEPS) return;

      clearInterval(timer);
      resolve({
        uploadId: "demo-upload-id",
        storageKey: `staging/demo-upload-id.${file.name.split(".").pop() ?? "png"}`,
        fileName: file.name,
        mimeType: file.type as ArtworkReference["mimeType"],
        sizeBytes: file.size,
        kind: "raster",
        widthPx: 2400,
        heightPx: 2400,
      });
    }, PROGRESS_STEP_MS);
  });

function rejectingUpload(error: ArtworkUploadError): UploadArtwork {
  return ({ signal }) =>
    new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(error), 600);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new ArtworkUploadError("aborted"));
      });
    });
}

function DemoCase({
  title,
  description,
  upload,
  initialValue = null,
}: {
  title: string;
  description: string;
  upload: UploadArtwork;
  initialValue?: ArtworkReference | null;
}) {
  const [value, setValue] = useState<ArtworkReference | null>(initialValue);

  return (
    <div className="max-w-md">
      <h3 className="font-medium text-foreground">{title}</h3>
      <p className="mt-1 mb-3 text-sm text-foreground-muted">{description}</p>
      <ArtworkUpload value={value} onChange={setValue} upload={upload} />
    </div>
  );
}

const PRESET_REFERENCE: ArtworkReference = {
  uploadId: "demo-existing",
  storageKey: "staging/demo-existing.pdf",
  fileName: "banner-artwork.pdf",
  mimeType: "application/pdf",
  sizeBytes: 3_355_443,
  kind: "vector",
  widthPx: null,
  heightPx: null,
};

export function ArtworkUploadDemo() {
  return (
    <div className="space-y-10">
      <DemoCase
        title="Idle → uploading → uploaded"
        description="Progress is simulated over about two seconds. Pick a PNG or JPG for a real thumbnail, or a PDF for the glyph tile."
        upload={simulatedUpload}
      />
      <DemoCase
        title="Upload always fails"
        description="Rejects after 600 ms so the error state and its retry are reachable. Try again fails again."
        upload={rejectingUpload(new ArtworkUploadError("presign_failed"))}
      />
      <DemoCase
        title="Rate limited"
        description="Rejects with a retry-after window, so the interpolated wait appears in the copy."
        upload={rejectingUpload(new ArtworkUploadError("rate_limited", 42))}
      />
      <DemoCase
        title="Already uploaded"
        description="Mounted with a reference and no upload history — the state a configurator rehydrates into. Replacing here succeeds."
        upload={simulatedUpload}
        initialValue={PRESET_REFERENCE}
      />
    </div>
  );
}
