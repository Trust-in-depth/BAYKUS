export class RateLimitDurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const now = Date.now();
    const raw = await this.state.storage.get("lastRequest");
    const last = typeof raw === "number" ? raw : 0;

    if (now - last < 1000) {
      return new Response("Rate limit exceeded", { status: 429 });
    }

    await this.state.storage.put("lastRequest", now);
    return new Response("Request accepted");
  }
}