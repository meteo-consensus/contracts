/**
 * True for a canonical `https:` URL with no credentials, query or fragment. A query string
 * could carry an API key or a signature, so such a URL is rejected rather than stored.
 */
export function isBareHttpsUrl(value: string): boolean {
  const url = URL.parse(value);
  return (
    url !== null &&
    url.href === value &&
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === ""
  );
}
