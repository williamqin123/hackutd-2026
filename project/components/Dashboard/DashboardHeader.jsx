import ThemeToggle from "../ThemeToggle";

export default function DashboardHeader({ isConnected, isReady }) {
  return (
    <header className="mb-7 flex flex-wrap items-center justify-between gap-5">
      <div className="flex items-center gap-3">
        <img className="size-11 rounded-xl shadow-[0_0_24px_#55f4d220]" src="/favicon-teal.svg" alt="" width="44" height="44" />

        <div>
          <p className="m-0 text-2xl font-bold tracking-tight text-wb-text">WaterBoard</p>
          <p className="mt-0.5 mb-0 text-xs text-wb-muted">Houston response center</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3.5 text-xs text-wb-muted">
        <span className="rounded-full border border-wb-warning/20 bg-wb-warning-soft px-3 py-1.5 font-semibold text-wb-warning">Demo data</span>

        <span role="status">
          {!isConnected
            ? "Disconnected"
            : isReady
              ? "Connected"
              : "Loading data…"}
        </span>
        <ThemeToggle />
      </div>
    </header>
  );
}
