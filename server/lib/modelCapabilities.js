/** Models whose Chat Completions contract only accepts the default temperature. */
export function requiresDefaultTemperature(model) {
  return /^(?:openai\/)?(?:gpt-5(?:[.-]|$)|o[1-9](?:[.-]|$))/i.test(String(model || '').trim());
}
