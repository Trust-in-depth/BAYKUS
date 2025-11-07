export class NotificationDurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/track" && request.method === "POST") {
      const raw = await this.state.storage.get("count");
      const count = typeof raw === "number" ? raw : 0;

      await this.state.storage.put("count", count + 1);
      return new Response("Tracked");
    }

    if (url.pathname === "/get-count") {
      const raw = await this.state.storage.get("count");
      const count = typeof raw === "number" ? raw : 0;

      return new Response(JSON.stringify({ count }));
    }

    return new Response("Not found", { status: 404 });
  }
}