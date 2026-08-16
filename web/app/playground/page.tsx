import ModeCard from "@/components/ModeCard";

export default function Playground() {
    return (
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
              href="/playground/free-drive"
            />

            <ModeCard
              title="Challenge Arena"
              description="Complete missions and beat your best score."
              icon="challenge"
              accent="accent"
              href="/playground/challenge-arena"
            />

            <ModeCard
              title="Training Ground"
              description="Practice your driving skills without restrictions."
              icon="training"
              accent="warning"
              href="/playground/training-ground"
            />
          </div>
        </section>
      </div>
    )
}
        
        