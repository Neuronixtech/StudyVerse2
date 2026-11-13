"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonVariant } from "./button";

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return ref;
}

const sizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizes;
  dismissible?: boolean;
}) {
  const ref = useDialog(open);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-2xl bg-white p-0 text-slate-600 shadow-2xl open:flex open:animate-slide-up open:flex-col",
        sizes[size],
      )}
    >
      {open && (
        <>
          <div className="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
            {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-ink">{title}</h2>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                className="-mt-1 -mr-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink"
                aria-label="Close dialog"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-line bg-slate-50/70 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </div>
          )}
        </>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  tone = "default",
  children,
  confirmDisabled,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  tone?: "default" | "danger";
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={description}
      icon={
        tone === "danger" ? (
          <span className="grid size-10 place-items-center rounded-full bg-red-50 text-red-600">
            <TriangleAlert className="size-5" />
          </span>
        ) : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : confirmVariant}
            disabled={confirmDisabled}
            onClick={() => {
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  footer,
  width = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  side?: "left" | "right";
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useDialog(open);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 h-dvh max-h-dvh w-full bg-white p-0 text-slate-600 shadow-2xl open:flex open:flex-col",
        width,
        side === "right" ? "ml-auto open:animate-slide-in-right" : "mr-auto open:animate-slide-in-left",
      )}
    >
      {open && (
        <>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-bold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-ink"
              aria-label="Close panel"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
