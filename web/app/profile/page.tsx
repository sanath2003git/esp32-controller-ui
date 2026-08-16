"use client"

import { RobotState } from "@/types/robot";
import { useBleContext } from "@/context/BleContext";

export default function Profile () {
    const {
      status,
      deviceInfo
    } = useBleContext();

  const robot: RobotState = {
    connectionStatus: status,
    info: {
      id: deviceInfo?.deviceId ?? "Unknown ID",
      name: deviceInfo?.name ?? "Unknown Robot",
      model: deviceInfo?.model ?? "Unknown model",
      firmware: deviceInfo?.firmware ?? "Unknown firmware",
      battery: 0,
    },
    };

    return (
        <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
            <section className="mt-8">
            <div className="rounded-2xl border border-border bg-surface p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                Robot status
                </p>

                <div className="mt-4 flex items-center justify-between">
                <div>
                    <p className="text-lg font-bold">
                    {robot.info?.name ?? "Unknown Robot"}
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                    {robot.info?.model ?? "Unknown model"}
                    </p>
                </div>

                <div
                    className={`h-3 w-3 rounded-full ${
                    robot.connectionStatus === "connected"
                        ? "bg-success shadow-[0_0_12px_rgba(53,229,154,0.7)]"
                        : "bg-white/20"
                    }`}
                />
                </div>
            </div>
            </section>
        </div>
    )
}