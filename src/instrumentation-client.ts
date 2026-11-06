import posthog from "posthog-js";

// Runs before the app is interactive, so the capture calls scattered through
// the components always have an initialised client behind them.
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  defaults: "2026-05-30",
});
