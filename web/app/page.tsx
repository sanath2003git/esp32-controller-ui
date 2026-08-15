import AppHeader from "@/components/AppHeader";
import ModeCard from "@/components/ModeCard";

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

        <section className="mt-8">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
              Game modes
            </p>

            <h3 className="mt-1 text-xl font-bold">
              Choose your mission
            </h3>
          </div>

          <div className="space-y-3">
            <ModeCard
              title="Free Drive"
              description="Take control and explore freely."
              icon="drive"
              accent="primary"
            />

            <ModeCard
              title="Challenge Arena"
              description="Complete missions and beat your best score."
              icon="challenge"
              accent="accent"
            />

            <ModeCard
              title="Training Ground"
              description="Practice your driving skills without restrictions."
              icon="training"
              accent="warning"
            />
          </div>
        </section>
      </div>
    </main>
  );
}