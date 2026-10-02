"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BluetoothConnectionGate from "@/components/BluetoothConnectionGate";
import BluetoothNotificationBanner from "@/components/BluetoothNotificationBanner";
import BottomNav from "@/components/BottomNav";
import { useBleContext } from "@/context/BleContext";
import { useEffect, useRef } from "react";

function TelemetryEmotionWatcher() {
  const { status, telemetry, send } = useBleContext();
  const lastEmotionSent = useRef<number>(0);
  
  useEffect(() => {
    if (status !== "connected" || !telemetry) return;
    
    const now = Date.now();
    // Rate limit sending emotions automatically to avoid spamming the BLE queue
    if (now - lastEmotionSent.current < 2000) return;
    
    let emojiId: number | null = null;
    
    // Multiple taps -> Hurt (5)
    if (telemetry.touch?.event === "double_tap" || telemetry.touch?.event === "hold") {
      emojiId = 5;
    } 
    // Sudden motion -> Dizzy (4)
    else if (telemetry.motion?.sudden) {
      emojiId = 4;
    }
    // Distance < 10cm -> Warning (6)
    else if (telemetry.distance?.front !== null && telemetry.distance.front < 10) {
      emojiId = 6;
    }
    
    if (emojiId !== null) {
      lastEmotionSent.current = now;
      send({ command: "oled_emoji", emoji_id: emojiId }).catch(() => {});
    }
  }, [telemetry, status, send]);
  
  return null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  const isRcMode = pathname.startsWith("/rc-mode");
  const showAppComponents = Boolean(isSignedIn && !isAuthPage);
  const isGamePage = /\/challenges\/\d+$/.test(pathname);
  const showAppHeader = showAppComponents && !isRcMode && !isGamePage;
  const showBottomNav = showAppComponents && !isGamePage;

  return (
    <>
      {showAppComponents && (
        <>
          {showAppHeader && <AppHeader />}
          <BluetoothNotificationBanner />
          <BluetoothConnectionGate />
          <TelemetryEmotionWatcher />
        </>
      )}

      <div className={showAppComponents && !isGamePage ? "pb-20" : ""}>{children}</div>

      {showBottomNav && <BottomNav />}
    </>
  );
}
