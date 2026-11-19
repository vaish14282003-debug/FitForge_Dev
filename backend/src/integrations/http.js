// Shared HTTP helper for provider APIs: form-encoded POSTs with a timeout, and errors that keep the
// provider's status code (401 = access revoked, 429 = rate limited) for the shared service to act on.

const TIMEOUT_MS = 10_000;

class ProviderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function postForm(url, form, { headers = {}, providerName = 'The service' } = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      res.status === 429 ? `${providerName} is busy right now. Try again in 15 minutes.` : `${providerName}: ${body.message || res.statusText}`;
    throw new ProviderError(res.status, message);
  }
  return body;
}

module.exports = { postForm, ProviderError };
