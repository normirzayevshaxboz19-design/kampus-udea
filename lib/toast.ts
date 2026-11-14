"use client";

import { useEffect, useState } from "react";

/** Simple toast notification system */
export function useToast() {
  const [toasts, setToasts] = useState<Array<{
    id: string;
    kind: "ok" | "err";
    text: string;
    timestamp: number;
  }>>( []);

  const add = (kind: "ok" | "err", text: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, kind, text, timestamp: Date.now() }]);
    // Auto-remove after 5 seconds
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
    return () => clearTimeout(timer);
  };

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    // Cleanup all timers on unmount
    return () => {
      setToasts([]);
    };
  }, []);

  return { toasts, add, remove };
}