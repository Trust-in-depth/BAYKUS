export class UserStatusDurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    interface StatusPayload {
  status: string;
}

if (url.pathname === "/set-status" && method === "POST") {
  const { status }: StatusPayload = await request.json();
  await this.state.storage.put("status", status);
  return new Response("Status updated");
}

    if (url.pathname === "/get-status") {
      const status = await this.state.storage.get("status");
      return new Response(JSON.stringify({ status }));
    }

    return new Response("Not found", { status: 404 });
  }
}