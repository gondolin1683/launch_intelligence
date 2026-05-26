export function parseCredentials(secretString) {
  const parsed = JSON.parse(secretString);
  const apiKey = parsed.apiKey ?? parsed.ANTHROPIC_API_KEY ?? parsed.token;
  if (!apiKey) throw new Error("LLM credentials secret has no apiKey");
  return {
    provider: parsed.provider ?? "anthropic",
    model: parsed.model ?? "claude-sonnet-4-6",
    apiKey
  };
}
