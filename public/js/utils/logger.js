const LOG_PREFIX = "KoolClick";

function normalizeMetadata(metadata = {}) {
  const safe = {};
  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  });
  return safe;
}

function emit(level, eventName, metadata = {}) {
  const payload = {
    event: eventName,
    ts: new Date().toISOString(),
    ...normalizeMetadata(metadata),
  };

  if (level === "error") {
    console.error(`[${LOG_PREFIX}]`, payload);
    return;
  }

  if (level === "warn") {
    console.warn(`[${LOG_PREFIX}]`, payload);
    return;
  }

  console.info(`[${LOG_PREFIX}]`, payload);
}

export function logInfo(eventName, metadata = {}) {
  emit("info", eventName, metadata);
}

export function logWarn(eventName, metadata = {}) {
  emit("warn", eventName, metadata);
}

export function logError(eventName, error, metadata = {}) {
  emit("error", eventName, {
    ...metadata,
    code: error?.code || "",
    message: error?.message || String(error || "Unknown error"),
  });
}
