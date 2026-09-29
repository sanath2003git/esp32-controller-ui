"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

export default function UserSync() {
  const { isSignedIn, user } = useUser();
  const syncedRef = useRef<boolean>(false);

  useEffect(() => {
    if (isSignedIn && user && !syncedRef.current) {
      syncedRef.current = true;
      fetch("/api/user/sync", { method: "POST" }).catch((error: unknown) => {
        console.error("[USER SYNC CLIENT ERROR]", error);
      });
    }
  }, [isSignedIn, user]);

  return null;
}
