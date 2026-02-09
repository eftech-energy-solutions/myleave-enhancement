export function safeSendEmail(sendFn, to, ...args) {
  if (!to || typeof to !== "string" || !to.trim()) {
    console.warn("⚠️ Email skipped (no recipient):", sendFn.name);
    return;
  }

  try {
    sendFn(to, ...args);
  } catch (err) {
    console.error("❌ Email send failed:", err.message);
  }
}