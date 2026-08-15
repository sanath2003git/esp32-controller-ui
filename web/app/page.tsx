import AppHeader from "@/components/AppHeader";

export default function Home() {
  return (
    <main className="min-h-screen">
      <AppHeader />

      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        <section>
          <p className="text-sm font-medium text-accent">
            Welcome back, Player
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Ready to play?
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/50">
            Choose a mode and start your next robot adventure.
          </p>
        </section>

        <section className="mt-8">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
              Robot status
            </p>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">MAINBOT</p>
                <p className="mt-1 text-xs text-white/40">
                  Device connected
                </p>
              </div>

              <div className="h-3 w-3 rounded-full bg-success shadow-[0_0_12px_rgba(53,229,154,0.7)]" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}