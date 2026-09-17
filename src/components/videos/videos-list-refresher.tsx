"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface VideosListRefresherProps {
  hasPendingVideos: boolean;
}

export function VideosListRefresher({ hasPendingVideos }: VideosListRefresherProps) {
  const router = useRouter();

  useEffect(() => {
    if (!hasPendingVideos) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 3000);

    return () => clearInterval(interval);
  }, [hasPendingVideos, router]);

  return null;
}
