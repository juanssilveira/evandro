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
    }, 3200);
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
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border bg-white dark:bg-zinc-900 shadow-md shadow-zinc-950/5 font-sans text-xs font-medium transition-all",
              "animate-in fade-in slide-in-from-bottom-4 duration-200",
              t.type === "error"
                ? "border-destructive/30 text-destructive bg-red-50/50 dark:bg-red-950/20"
                : t.type === "info"
                ? "border-primary/20 text-foreground"
                : "border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {t.type === "error" ? (
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                  <AlertCircle className="size-3.5" />
                </div>
              ) : t.type === "info" ? (
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Info className="size-3.5" />
                </div>
              ) : (
                <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                </div>
              )}
              <span className="truncate">{t.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
              aria-label="Fechar notificação"
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
