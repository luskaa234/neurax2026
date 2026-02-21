function tryParseObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function extractBalancedJsonObject(input: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          return input.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

export function parsePossiblyWrappedJson(input: string): Record<string, unknown> | null {
  const trimmed = input.trim();

  const direct = tryParseObject(trimmed);
  if (direct) {
    return direct;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    const fencedParsed = tryParseObject(fencedMatch[1].trim());
    if (fencedParsed) {
      return fencedParsed;
    }
  }

  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced) {
    return tryParseObject(balanced);
  }

  return null;
}
