export class PrivateChatDurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === "/send-dm" && method === "POST") {
      const body = await request.json();

      const raw = await this.state.storage.get("dmHistory");
      const history: any[] = Array.isArray(raw) ? raw : [];

      history.push(body);
      await this.state.storage.put("dmHistory", history);

      return new Response("DM sent");
    }

    if (url.pathname === "/get-dm-history") {
      const history = await this.state.storage.get("dmHistory");
      return new Response(JSON.stringify(history || []));
    }

    return new Response("Not found", { status: 404 });
  }
}