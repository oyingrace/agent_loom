function horizonBaseUrl(): string {
  const raw =
    process.env.STELLAR_HORIZON_URL?.trim() ||
    "https://horizon-testnet.stellar.org";
  return raw.replace(/\/$/, "");
}

export async function horizonFetchJson<T>(path: string): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${horizonBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Horizon HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
