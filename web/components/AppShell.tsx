"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BluetoothConnectionGate from "@/components/BluetoothConnectionGate";
import BluetoothNotificationBanner from "@/components/BluetoothNotificationBanner";
import BottomNav from "@/components/BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  const isRcMode = pathname.startsWith("/rc-mode");
  const showAppComponents = Boolean(isSignedIn && !isAuthPage);
  const isGamePage = pathname.includes("/challenges/");
  const showAppHeader = showAppComponents && !isRcMode && !isGamePage;
  const showBottomNav = showAppComponents && !isGamePage;

  return (
    <>
      {showAppComponents && (
        <>
          {showAppHeader && <AppHeader />}
          <BluetoothNotificationBanner />
          <BluetoothConnectionGate />
        </>
      )}

      <div className={showAppComponents && !isGamePage ? "pb-20" : ""}>{children}</div>

      {showBottomNav && <BottomNav />}
    </>
  );
}
