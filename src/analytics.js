const enabled = typeof window !== "undefined" && typeof window.gtag === "function";

export function trackEvent(name, params = {}) {
  if (!enabled) return;
  window.gtag("event", name, cleanParams(params));
}

export function setUserStats(stats = {}) {
  if (!enabled) return;
  window.gtag("set", "user_properties", cleanParams(stats));
}

export function streakBucket(streak) {
  if (streak >= 30) return "30+";
  if (streak >= 14) return "14-29";
  if (streak >= 7) return "7-13";
  if (streak >= 4) return "4-6";
  if (streak >= 2) return "2-3";
  return String(streak || 0);
}

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) =>
      value !== undefined && value !== null && value !== ""
    )
  );
}
