const RUN_INTERVAL_MS = 15 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { runAutomations } = await import("@/lib/automations");

  const run = () => {
    runAutomations().catch((err) => {
      console.error("[automations] scheduled run failed:", err);
    });
  };

  setTimeout(() => {
    run();
    setInterval(run, RUN_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
