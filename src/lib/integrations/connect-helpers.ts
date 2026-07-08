import type { ProviderCatalogEntry } from "./catalog";

export interface ParsedConnection {
  config: Record<string, string>;
  secret: string;
  missing: string[];
}

/**
 * Splits a submitted field-values object into non-secret config + the secret,
 * according to the provider catalog entry, and reports missing required fields.
 */
export function parseConnectionBody(
  entry: ProviderCatalogEntry,
  body: Record<string, unknown>,
): ParsedConnection {
  const config: Record<string, string> = {};
  let secret = "";
  const missing: string[] = [];

  for (const field of entry.fields) {
    const value = String(body[field.name] ?? "").trim();
    if (!value && !field.optional) {
      missing.push(field.label);
    }
    if (field.name === entry.secretField) {
      secret = value;
    } else {
      config[field.name] = value;
    }
  }

  return { config, secret, missing };
}
