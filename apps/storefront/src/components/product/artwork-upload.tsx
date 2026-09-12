"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { ARTWORK_ACCEPTED_LABEL } from "@craftynp/types";

import {
  ARTWORK_ACCEPT,
  ARTWORK_SIZE_LIMIT_LABEL,
  ArtworkUploadError,
  artworkUploadMessage,
  checkArtworkFile,
  formatFileSize,
  isPreviewableArtwork,
  isRetryableArtworkUpload,
  uploadArtwork,
} from "@/lib/artwork-upload";
import type {
  ArtworkReference,
  ArtworkUploadErrorCode,
  UploadArtwork,
} from "@/lib/artwork-upload";

import {
  ArrowsClockwise,
  CheckCircle,
  FileArrowUp,
  FilePdf,
  Trash,
  WarningCircle,
} from "../icons";

export type ArtworkUploadProps = {
  value: ArtworkReference | null;
  onChange: (next: ArtworkReference | null) => void;
  label?: string;
  disabled?: boolean;
  upload?: UploadArtwork;
  // What the shopper needs to know before choosing a file, and what is wrong
  // with the one they chose. Both are derived by the parent, which is the only
  // thing that knows the ordered size — this component stays controlled on the
  // durable reference alone.
  guidance?: string;
  errorMessage?: string | null;
  focusTargetId?: string;
};

type InternalState =
  | { status: "quiet" }
  | { status: "uploading"; file: File; fraction: number }
  | {
      status: "failed";
      file: File | null;
      code: ArtworkUploadErrorCode;
      retryAfterSeconds: number | null;
    };

type PendingFocus = "browse" | "cancel" | "retry" | null;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset";

const primaryActionClassName = `inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

const secondaryActionClassName = `inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export function ArtworkUpload({
  value,
  onChange,
  label = "Your artwork",
  disabled = false,
  upload = uploadArtwork,
  guidance,
  errorMessage = null,
  focusTargetId,
}: ArtworkUploadProps) {
  const [state, setState] = useState<InternalState>({ status: "quiet" });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const dragDepthRef = useRef(0);
  const pendingFocusRef = useRef<PendingFocus>(null);

  const hintId = useId();
  const guidanceId = useId();
  const uploadErrorId = useId();

  const view =
    state.status === "uploading"
      ? "uploading"
      : state.status === "failed"
        ? "error"
        : value
          ? "uploaded"
          : "idle";

  useEffect(() => {
    const target = pendingFocusRef.current;
    if (!target) return;
    pendingFocusRef.current = null;

    if (target === "browse") browseRef.current?.focus();
    if (target === "cancel") cancelRef.current?.focus();
    if (target === "retry") retryRef.current?.focus();
  }, [view]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  function releasePreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }

  function adoptPreview(file: File) {
    releasePreview();
    if (!isPreviewableArtwork(file.type)) return;
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  function fail(file: File | null, error: unknown) {
    const code =
      error instanceof ArtworkUploadError ? error.code : "presign_failed";
    const retryAfterSeconds =
      error instanceof ArtworkUploadError ? error.retryAfterSeconds : null;

    if (code === "aborted") {
      setState({ status: "quiet" });
      setAnnouncement(artworkUploadMessage("aborted"));
      pendingFocusRef.current = "browse";
      return;
    }

    setAnnouncement("");
    setState({ status: "failed", file, code, retryAfterSeconds });
  }

  function startUpload(file: File) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setAnnouncement(
      value
        ? `Replacing ${value.fileName} with ${file.name}.`
        : `Uploading ${file.name}.`,
    );
    setState({ status: "uploading", file, fraction: 0 });
    pendingFocusRef.current = "cancel";

    upload({
      file,
      signal: controller.signal,
      onProgress: (progress) => {
        setState((current) =>
          current.status === "uploading" && current.file === file
            ? { ...current, fraction: progress.fraction }
            : current,
        );
      },
    })
      .then((reference) => {
        if (controller.signal.aborted) return;
        adoptPreview(file);
        setState({ status: "quiet" });
        setAnnouncement(
          `Uploaded ${reference.fileName}, ${formatFileSize(reference.sizeBytes)}.`,
        );
        pendingFocusRef.current = "browse";
        onChange(reference);
      })
      .catch((error: unknown) => {
        fail(file, error);
      });
  }

  function acceptFile(file: File) {
    const check = checkArtworkFile(file);
    if (!check.ok) {
      setAnnouncement("");
      setState({
        status: "failed",
        file: null,
        code: check.code,
        retryAfterSeconds: null,
      });
      return;
    }

    startUpload(file);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) acceptFile(file);
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function handleCancel() {
    controllerRef.current?.abort();
  }

  function handleRemove() {
    controllerRef.current?.abort();
    releasePreview();
    setState({ status: "quiet" });
    setAnnouncement("Artwork removed.");
    pendingFocusRef.current = "browse";
    onChange(null);
  }

  function handleRetry() {
    if (state.status !== "failed" || !state.file) return;
    startUpload(state.file);
  }

  function handleKeepCurrent() {
    setState({ status: "quiet" });
    pendingFocusRef.current = "browse";
  }

  function handleDragEnter(event: React.DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    if (dragDepthRef.current === 1) setIsDraggingOver(true);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDraggingOver(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingOver(false);

    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) return;

    if (files.length > 1) {
      setAnnouncement("");
      setState({
        status: "failed",
        file: null,
        code: "multiple_files",
        retryAfterSeconds: null,
      });
      return;
    }

    const [file] = files;
    if (file) acceptFile(file);
  }

  const zoneClassName = [
    "rounded-xl border border-dashed p-6 transition-colors",
    isDraggingOver
      ? "border-primary bg-surface-soft"
      : "border-border bg-surface",
  ].join(" ");

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={zoneClassName}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ARTWORK_ACCEPT}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={handleInputChange}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {view === "idle" ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <FileArrowUp aria-hidden="true" size={28} />
          <p className="font-medium text-foreground">{label}</p>
          <button
            type="button"
            ref={browseRef}
            id={focusTargetId}
            disabled={disabled}
            aria-describedby={hintId}
            onClick={openPicker}
            className={primaryActionClassName}
          >
            Choose a file
          </button>
          <p id={hintId} className="text-sm text-foreground-muted">
            {isDraggingOver
              ? "Release to upload"
              : `or drag one here — ${guidance ?? `${ARTWORK_ACCEPTED_LABEL}, up to ${ARTWORK_SIZE_LIMIT_LABEL}.`}`}
          </p>
        </div>
      ) : null}

      {state.status === "uploading" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">
            Uploading {state.file.name}
          </p>
          <progress
            aria-label={`Uploading ${state.file.name}`}
            value={Math.round(state.fraction * 100)}
            max={100}
            className="h-2 w-full overflow-hidden rounded-full"
          />
          <p className="text-sm text-foreground-muted">
            {Math.round(state.fraction * 100)}% of{" "}
            {formatFileSize(state.file.size)}
          </p>
          <div>
            <button
              type="button"
              ref={cancelRef}
              onClick={handleCancel}
              className={secondaryActionClassName}
            >
              Cancel upload
            </button>
          </div>
        </div>
      ) : null}

      {view === "uploaded" && value ? (
        <div className="flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-soft">
            {previewUrl && isPreviewableArtwork(value.mimeType) ? (
              <Image
                src={previewUrl}
                alt=""
                fill
                unoptimized
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center">
                <FilePdf aria-hidden="true" size={24} />
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle aria-hidden="true" size={16} />
              Uploaded {value.fileName} · {formatFileSize(value.sizeBytes)}
            </p>
            {errorMessage ? (
              // The upload itself succeeded, so this sits on the uploaded view
              // rather than the error one: the file is attached, it just
              // cannot be printed at the size ordered.
              <p
                id={guidanceId}
                role="alert"
                className="flex items-start gap-2 text-sm text-danger-foreground"
              >
                <WarningCircle aria-hidden="true" size={16} />
                {errorMessage}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                ref={browseRef}
                id={focusTargetId}
                disabled={disabled}
                aria-describedby={errorMessage ? guidanceId : undefined}
                onClick={openPicker}
                className={secondaryActionClassName}
              >
                <ArrowsClockwise aria-hidden="true" size={16} />
                Replace file
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={handleRemove}
                className={secondaryActionClassName}
              >
                <Trash aria-hidden="true" size={16} />
                Remove file
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state.status === "failed" ? (
        <div className="flex flex-col gap-3">
          <p
            id={uploadErrorId}
            role="alert"
            className="flex items-start gap-2 text-sm text-danger-foreground"
          >
            <WarningCircle aria-hidden="true" size={16} />
            {artworkUploadMessage(state.code, {
              sizeBytes: state.file?.size,
              retryAfterSeconds: state.retryAfterSeconds,
            })}
          </p>
          {value ? (
            <p className="text-sm text-foreground-muted">
              Your previously uploaded file is still attached.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {isRetryableArtworkUpload(state.code) && state.file ? (
              <button
                type="button"
                ref={retryRef}
                aria-describedby={uploadErrorId}
                onClick={handleRetry}
                className={primaryActionClassName}
              >
                Try again
              </button>
            ) : null}
            <button
              type="button"
              ref={browseRef}
              id={focusTargetId}
              disabled={disabled}
              aria-describedby={uploadErrorId}
              onClick={openPicker}
              className={secondaryActionClassName}
            >
              Choose a different file
            </button>
            {value ? (
              <button
                type="button"
                onClick={handleKeepCurrent}
                className={secondaryActionClassName}
              >
                Keep current file
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
