export const TITLE_MODEL = "gpt-4.1-mini";

const pickFirstString = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string");
    return typeof first === "string" ? first.trim() : "";
  }
  return "";
};

export const extractTitleFromResponse = (payload: unknown): string => {
  if (!payload) return "";
  if (typeof payload === "string") return payload.trim();

  if (Array.isArray(payload)) {
    return pickFirstString(payload);
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.title === "string") return record.title.trim();
    if (typeof record.name === "string") return record.name.trim();

    if (Array.isArray(record.output_text) || typeof record.output_text === "string") {
      const text = pickFirstString(record.output_text);
      if (text) return text;
    }

    if (Array.isArray(record.output) || typeof record.output === "string") {
      const text = pickFirstString(record.output);
      if (text) return text;
    }

    const choices = record.choices;
    if (Array.isArray(choices)) {
      for (const choice of choices) {
        if (typeof choice === "string") {
          const trimmed = choice.trim();
          if (trimmed) return trimmed;
          continue;
        }
        if (choice && typeof choice === "object") {
          const message = (choice as Record<string, unknown>).message;
          if (typeof message === "string" && message.trim()) return message.trim();
          if (message && typeof message === "object") {
            const content = (message as Record<string, unknown>).content;
            if (typeof content === "string" && content.trim()) return content.trim();
            if (Array.isArray(content)) {
              const text = pickFirstString(content);
              if (text) return text;
            }
          }
        }
      }
    }
  }

  return "";
};

