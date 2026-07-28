/**
 * Lightweight, unauthenticated health check used to keep the Render service
 * warm (free instances spin down after ~15 min idle, and a cold start blows the
 * post-purchase `ShouldRender` network budget). It touches no database and does
 * no auth, so it returns almost instantly.
 *
 * Route path: /healthz
 */
export const loader = () => {
  return new Response("ok", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
