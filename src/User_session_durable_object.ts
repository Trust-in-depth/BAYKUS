export class UserSessionDurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === "/update-last-seen" && method === "POST") {
      const now = new Date().toISOString();
      await this.state.storage.put("lastSeen", now);
      return new Response("Updated");
    }

    if (url.pathname === "/get-last-seen") {
      const lastSeen = await this.state.storage.get("lastSeen");
      return new Response(JSON.stringify({ lastSeen }));
    }

    return new Response("Not found", { status: 404 });
  }
}