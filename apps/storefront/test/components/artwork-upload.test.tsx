import { MAX_ARTWORK_BYTES } from "@craftynp/types";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";

import { ArtworkUpload } from "@/components";
import { ArtworkUploadError } from "@/lib/artwork-upload";
import type {
  ArtworkReference,
  ArtworkUploadProgress,
  UploadArtwork,
  UploadArtworkOptions,
} from "@/lib/artwork-upload";

function makeFile({
  name = "logo.png",
  type = "image/png",
  size = 1_572_864,
}: { name?: string; type?: string; size?: number } = {}) {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function referenceFor(file: File): ArtworkReference {
  return {
    uploadId: "upload-1",
    storageKey: "staging/upload-1.png",
    fileName: file.name,
    mimeType: file.type as ArtworkReference["mimeType"],
    sizeBytes: file.size,
    kind: "raster",
    widthPx: 1200,
    heightPx: 1200,
  };
}

function deferredUpload() {
  const calls: UploadArtworkOptions[] = [];
  let settle: {
    resolve: (reference: ArtworkReference) => void;
    reject: (error: unknown) => void;
  } | null = null;

  const upload: UploadArtwork = (options) => {
    calls.push(options);
    return new Promise((resolve, reject) => {
      settle = { resolve, reject };
    });
  };

  return {
    upload: jest.fn(upload),
    calls,
    lastFile: () => calls[calls.length - 1]?.file,
    emitProgress: (progress: ArtworkUploadProgress) =>
      act(() => {
        calls[calls.length - 1]?.onProgress?.(progress);
      }),
    resolve: async (reference: ArtworkReference) => {
      await act(async () => {
        settle?.resolve(reference);
      });
    },
    reject: async (error: unknown) => {
      await act(async () => {
        settle?.reject(error);
      });
    },
  };
}

function Harness({
  initialValue = null,
  onChange,
  upload,
}: {
  initialValue?: ArtworkReference | null;
  onChange: (next: ArtworkReference | null) => void;
  upload?: UploadArtwork;
}) {
  const [value, setValue] = useState<ArtworkReference | null>(initialValue);

  return (
    <ArtworkUpload
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      upload={upload}
    />
  );
}

function selectFile(file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input rendered");
  fireEvent.change(input, { target: { files: [file] } });
}

function dropFiles(files: File[]) {
  const zone = screen.getByRole("status").parentElement;
  if (!zone) throw new Error("no drop zone rendered");
  fireEvent.drop(zone, {
    dataTransfer: { files, items: [], types: ["Files"], dropEffect: "none" },
  });
  return zone;
}

describe("ArtworkUpload", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => "blob:artwork-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: jest.fn(),
    });
  });

  it("hands the parent the reference the transport returned, and only on success", async () => {
    const onChange = jest.fn();
    const transport = deferredUpload();
    const file = makeFile();

    render(
      <ArtworkUpload
        value={null}
        onChange={onChange}
        upload={transport.upload}
      />,
    );

    selectFile(file);
    expect(transport.upload).toHaveBeenCalledTimes(1);
    expect(transport.lastFile()).toBe(file);
    expect(onChange).not.toHaveBeenCalled();

    await transport.resolve(referenceFor(file));
    expect(onChange).toHaveBeenCalledWith(referenceFor(file));
  });

  it("shows determinate progress without telling the parent anything", async () => {
    const onChange = jest.fn();
    const transport = deferredUpload();

    render(
      <ArtworkUpload
        value={null}
        onChange={onChange}
        upload={transport.upload}
      />,
    );

    selectFile(makeFile());
    transport.emitProgress({
      loaded: 786_432,
      total: 1_572_864,
      fraction: 0.5,
    });

    expect(screen.getByRole("progressbar")).toHaveValue(50);
    expect(screen.getByText(/50% of 1\.5 MB/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("confirms the upload with the filename and its size", async () => {
    const transport = deferredUpload();
    const file = makeFile();

    render(<Harness onChange={jest.fn()} upload={transport.upload} />);

    selectFile(file);
    await transport.resolve(referenceFor(file));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Uploaded logo.png, 1.5 MB.",
    );
    expect(
      screen.getByText(/Uploaded logo\.png · 1\.5 MB/),
    ).toBeInTheDocument();
  });

  it("rejects an oversize file itself rather than spending a presign request", () => {
    const transport = deferredUpload();

    render(
      <ArtworkUpload
        value={null}
        onChange={jest.fn()}
        upload={transport.upload}
      />,
    );

    selectFile(makeFile({ size: MAX_ARTWORK_BYTES + 1 }));

    expect(screen.getByRole("alert")).toHaveTextContent("25 MB");
    expect(transport.upload).not.toHaveBeenCalled();
  });

  it("retries with the same file instead of reopening the picker", async () => {
    const transport = deferredUpload();
    const file = makeFile();

    render(
      <ArtworkUpload
        value={null}
        onChange={jest.fn()}
        upload={transport.upload}
      />,
    );

    selectFile(file);
    await transport.reject(new ArtworkUploadError("presign_failed"));

    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(transport.upload).toHaveBeenCalledTimes(2);
    expect(transport.lastFile()).toBe(file);
  });

  it("describes both ways out of a failed upload with the error itself", async () => {
    const transport = deferredUpload();

    render(
      <ArtworkUpload
        value={null}
        onChange={jest.fn()}
        upload={transport.upload}
      />,
    );

    selectFile(makeFile());
    await transport.reject(new ArtworkUploadError("presign_failed"));

    const message = screen.getByRole("alert").textContent ?? "";
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toHaveAccessibleDescription(message);
    expect(
      screen.getByRole("button", { name: "Choose a different file" }),
    ).toHaveAccessibleDescription(message);
  });

  it("keeps every view's actions inside a group named by the field", async () => {
    const transport = deferredUpload();
    const file = makeFile();

    render(<Harness onChange={jest.fn()} upload={transport.upload} />);

    selectFile(file);
    await transport.resolve(referenceFor(file));

    expect(
      within(screen.getByRole("group", { name: "Your artwork" })).getByRole(
        "button",
        { name: /replace file/i },
      ),
    ).toBeInTheDocument();
  });

  it("offers no retry for a failure that retrying cannot fix", async () => {
    const transport = deferredUpload();

    render(
      <ArtworkUpload
        value={null}
        onChange={jest.fn()}
        upload={transport.upload}
      />,
    );

    selectFile(makeFile({ type: "text/plain" }));

    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Choose a different file" }),
    ).toBeInTheDocument();
  });

  it("keeps the previous artwork attached when a replacement fails", async () => {
    const onChange = jest.fn();
    const transport = deferredUpload();
    const existing: ArtworkReference = {
      uploadId: "upload-0",
      storageKey: "staging/upload-0.pdf",
      fileName: "original.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2_097_152,
      kind: "vector",
      widthPx: null,
      heightPx: null,
    };

    render(
      <ArtworkUpload
        value={existing}
        onChange={onChange}
        upload={transport.upload}
      />,
    );

    selectFile(makeFile({ name: "replacement.png" }));
    await transport.reject(new ArtworkUploadError("put_network"));

    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByText(/previously uploaded file is still attached/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep current file" }));
    expect(screen.getByText(/original\.pdf/)).toBeInTheDocument();
  });

  it("clears the reference and releases the preview it created on remove", async () => {
    const onChange = jest.fn();
    const transport = deferredUpload();
    const file = makeFile();

    render(<Harness onChange={onChange} upload={transport.upload} />);

    selectFile(file);
    await transport.resolve(referenceFor(file));

    const created = (URL.createObjectURL as jest.Mock).mock.results[0]
      ?.value as string;

    fireEvent.click(screen.getByRole("button", { name: /Remove file/ }));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(created);
    expect(
      screen.getByRole("button", { name: "Choose a file" }),
    ).toBeInTheDocument();
  });

  it("uploads a single dropped file and refuses a multi-file drop", () => {
    const transport = deferredUpload();

    render(
      <ArtworkUpload
        value={null}
        onChange={jest.fn()}
        upload={transport.upload}
      />,
    );

    dropFiles([makeFile({ name: "a.png" }), makeFile({ name: "b.png" })]);

    expect(screen.getByRole("alert")).toHaveTextContent("one file at a time");
    expect(transport.upload).not.toHaveBeenCalled();
  });

  it("uploads a single dropped file", () => {
    const transport = deferredUpload();
    const file = makeFile();

    render(
      <ArtworkUpload
        value={null}
        onChange={jest.fn()}
        upload={transport.upload}
      />,
    );

    dropFiles([file]);

    expect(transport.upload).toHaveBeenCalledTimes(1);
    expect(transport.lastFile()).toBe(file);
  });

  it("stays in the drag state while the pointer crosses its own children", () => {
    render(<ArtworkUpload value={null} onChange={jest.fn()} />);

    const zone = screen.getByRole("status").parentElement!;
    const dataTransfer = {
      files: [],
      items: [],
      types: ["Files"],
      dropEffect: "none",
    };

    fireEvent.dragEnter(zone, { dataTransfer });
    expect(screen.getByText("Release to upload")).toBeInTheDocument();

    fireEvent.dragEnter(zone, { dataTransfer });
    fireEvent.dragLeave(zone, { dataTransfer });
    expect(screen.getByText("Release to upload")).toBeInTheDocument();

    fireEvent.dragLeave(zone, { dataTransfer });
    expect(screen.queryByText("Release to upload")).toBeNull();
  });

  it("names the size and type limits on the control before a file is chosen", () => {
    render(<ArtworkUpload value={null} onChange={jest.fn()} />);

    expect(
      screen.getByRole("button", { name: "Choose a file" }),
    ).toHaveAccessibleDescription(
      /PNG, JPG, WEBP, SVG, PDF or AI, up to 25 MB/,
    );
  });

  it("shows the resolution the shopper needs before they choose a file", () => {
    // Told only after a rejection, the guidance costs an upload to learn.
    render(
      <ArtworkUpload
        value={null}
        onChange={jest.fn()}
        guidance="PNG, JPG, WEBP, SVG, PDF or AI, up to 25 MB. At 3″ wide we need at least 900 pixels across (300 DPI)."
      />,
    );

    expect(
      screen.getByRole("button", { name: "Choose a file" }),
    ).toHaveAccessibleDescription(/at least 900 pixels across \(300 DPI\)/);
  });

  it("reports a file that uploaded but cannot be printed, and keeps it attached", () => {
    render(
      <ArtworkUpload
        value={{
          uploadId: "upload-3",
          storageKey: "staging/upload-3.png",
          fileName: "screenshot.png",
          mimeType: "image/png",
          sizeBytes: 51_200,
          kind: "raster",
          widthPx: 400,
          heightPx: 400,
        }}
        onChange={jest.fn()}
        errorMessage="This file works out at 50 DPI at 8″ wide. We need at least 300 DPI — about 2,400 pixels across. Upload a higher-resolution file."
      />,
    );

    // The upload succeeded, so the file stays on screen with its name; what
    // failed is the resolution, and Replace is the way out of it.
    expect(screen.getByText(/screenshot\.png/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/50 DPI/);
    expect(screen.getByRole("alert")).toHaveTextContent(/at least 300 DPI/);
    expect(
      screen.getByRole("button", { name: "Replace file" }),
    ).toHaveAccessibleDescription(/2,400 pixels across/);
  });

  it("renders the uploaded view from a reference alone, with no upload history", () => {
    render(
      <ArtworkUpload
        value={{
          uploadId: "upload-9",
          storageKey: "staging/upload-9.pdf",
          fileName: "banner.pdf",
          mimeType: "application/pdf",
          sizeBytes: 3_355_443,
          kind: "vector",
          widthPx: null,
          heightPx: null,
        }}
        onChange={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/Uploaded banner\.pdf · 3\.2 MB/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Replace file/ }),
    ).toBeInTheDocument();
  });

  it("announces a cancelled upload and leaves no error behind", async () => {
    const transport = deferredUpload();

    render(
      <ArtworkUpload
        value={null}
        onChange={jest.fn()}
        upload={transport.upload}
      />,
    );

    selectFile(makeFile());
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));
    await transport.reject(new ArtworkUploadError("aborted"));

    expect(screen.getByRole("status")).toHaveTextContent("Upload cancelled.");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
