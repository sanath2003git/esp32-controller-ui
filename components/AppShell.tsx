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
  const showAppComponents = Boolean(isSignedIn && !isAuthPage);

  return (
    <>
      {showAppComponents && (
        <>
          <AppHeader />
          <BluetoothNotificationBanner />
          <BluetoothConnectionGate />
        </>
      )}

      <div className={showAppComponents ? "pb-20" : ""}>{children}</div>

      {showAppComponents && <BottomNav />}
    </>
  );
}
