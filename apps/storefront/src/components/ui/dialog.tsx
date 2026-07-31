"use client";

import { AlertDialog as HeroAlertDialog } from "@heroui/react/alert-dialog";
import { Modal as HeroModal } from "@heroui/react/modal";
import type { ReactNode } from "react";

import { X } from "../icons";
import { Button } from "./button";

export type DialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  children: ReactNode | ((props: { close: () => void }) => ReactNode);
};

export function Dialog({ isOpen, onOpenChange, title, children }: DialogProps) {
  return (
    <HeroModal>
      <HeroModal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <HeroModal.Container size="sm">
          <HeroModal.Dialog aria-label={title}>
            <HeroModal.CloseTrigger>
              <X aria-hidden="true" size={18} />
              <span className="sr-only">Close</span>
            </HeroModal.CloseTrigger>
            <HeroModal.Header>
              <HeroModal.Heading className="font-display text-xl text-foreground">
                {title}
              </HeroModal.Heading>
            </HeroModal.Header>
            <HeroModal.Body>
              {typeof children === "function"
                ? children({ close: () => onOpenChange(false) })
                : children}
            </HeroModal.Body>
          </HeroModal.Dialog>
        </HeroModal.Container>
      </HeroModal.Backdrop>
    </HeroModal>
  );
}

export type ConfirmDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isConfirming?: boolean;
};

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  isConfirming = false,
}: ConfirmDialogProps) {
  return (
    <HeroAlertDialog>
      <HeroAlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <HeroAlertDialog.Container>
          <HeroAlertDialog.Dialog
            aria-label={title}
            className="sm:max-w-[420px]"
          >
            <HeroAlertDialog.Header>
              <HeroAlertDialog.Icon status="danger" />
              <HeroAlertDialog.Heading className="font-display text-xl text-foreground">
                {title}
              </HeroAlertDialog.Heading>
            </HeroAlertDialog.Header>
            <HeroAlertDialog.Body>
              <p className="text-sm text-foreground-muted">{description}</p>
            </HeroAlertDialog.Body>
            <HeroAlertDialog.Footer>
              <Button
                variant="secondary"
                onPress={() => onOpenChange(false)}
                isDisabled={isConfirming}
              >
                {cancelLabel}
              </Button>
              <Button
                variant="danger"
                onPress={onConfirm}
                isLoading={isConfirming}
                loadingLabel={confirmLabel}
              >
                {confirmLabel}
              </Button>
            </HeroAlertDialog.Footer>
          </HeroAlertDialog.Dialog>
        </HeroAlertDialog.Container>
      </HeroAlertDialog.Backdrop>
    </HeroAlertDialog>
  );
}
