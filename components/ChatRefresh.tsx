"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Chatni ochiq turgan foydalanuvchida har 20 soniyada yangilab turadi. */
export function ChatRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
