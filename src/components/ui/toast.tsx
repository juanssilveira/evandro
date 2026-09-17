"use client";

import * as React from "react";
import { useState, useCallback, createContext, useContext } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md font-sans text-xs font-medium transition-all",
              "animate-in fade-in slide-in-from-bottom-4 duration-200",
              t.type === "error"
                ? "bg-destructive text-destructive-foreground border-destructive/20"
                : "bg-zinc-950/95 text-white dark:bg-zinc-100 dark:text-zinc-900 border-white/15 dark:border-zinc-800"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {t.type === "error" ? (
                <AlertCircle className="size-4 shrink-0 text-white dark:text-destructive" />
              ) : t.type === "info" ? (
                <Info className="size-4 shrink-0 text-primary" />
              ) : (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400 dark:text-emerald-600" />
              )}
              <span className="truncate">{t.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      toast: (msg: string) => {
        console.log(`[Toast] ${msg}`);
      },
    };
  }
  return context;
}
