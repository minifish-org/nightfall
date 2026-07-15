/**
 * Tolerant decoder for a seat's decision.
 *
 * agentd records the agent's final JSON directly as the run's `output`. The host
 * provider is an LLM, so even though we ask for a
 * bare JSON object the model sometimes wraps it in a ```json fence or prepends
 * prose. This salvages a JSON object from any of those shapes. It never throws;
 * unparseable input returns null so the referee can fall back to a safe
 * default (pass / no-op).
 */
export function coerceDecision(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;

  const text = raw.trim();

  // 1. Direct parse.
  const direct = tryParse(text);
  if (direct) return direct;

  // 2. Strip a Markdown code fence (```json ... ``` or ``` ... ```).
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const inner = tryParse(fence[1]!.trim());
    if (inner) return inner;
  }

  // 3. Grab the first balanced {...} object in the string.
  const slice = firstJsonObject(text);
  if (slice) {
    const obj = tryParse(slice);
    if (obj) return obj;
  }

  return null;
}

function tryParse(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Return the substring of the first brace-balanced object, or null. */
function firstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
