/** Market quotes require no optional Longbridge OAuth scope. The provider's
 * consent page can still preselect optional permissions, so the user must
 * review and deselect those there before authorizing. */
export function marketDataAuthorizationUrl(advertised: URL): URL {
  const limited = new URL(advertised);
  limited.searchParams.set("scope", "");
  return limited;
}
