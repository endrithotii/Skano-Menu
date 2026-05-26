"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild>
                <motion.div
                  key="overlay"
                  className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>

              <Dialog.Content asChild>
                <motion.div
                  key="content"
                  className={cn(
                    "fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 px-4",
                    sizeClasses[size]
                  )}
                  initial={{ opacity: 0, scale: 0.95, y: "-48%" }}
                  animate={{ opacity: 1, scale: 1, y: "-50%" }}
                  exit={{ opacity: 0, scale: 0.95, y: "-48%" }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <div
                    className={cn(
                      "bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden",
                      className
                    )}
                  >
                    {(title || description) && (
                      <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100">
                        <div>
                          {title && (
                            <Dialog.Title className="text-lg font-semibold text-gray-900">
                              {title}
                            </Dialog.Title>
                          )}
                          {description && (
                            <Dialog.Description className="mt-1 text-sm text-gray-500">
                              {description}
                            </Dialog.Description>
                          )}
                        </div>
                        <Dialog.Close
                          onClick={onClose}
                          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          <span className="sr-only">Close</span>
                        </Dialog.Close>
                      </div>
                    )}

                    {!(title || description) && (
                      <Dialog.Close
                        onClick={onClose}
                        className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
                      >
                        <X className="w-4 h-4" />
                        <span className="sr-only">Close</span>
                      </Dialog.Close>
                    )}

                    <div className="p-6">{children}</div>
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
