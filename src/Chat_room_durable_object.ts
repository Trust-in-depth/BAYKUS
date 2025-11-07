export class ChatRoomDurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

  if (url.pathname === "/send-message" && method === "POST") {
  const body = await request.json();
  const raw = await this.state.storage.get("messages");
  const messages = Array.isArray(raw) ? raw : [];
  messages.push(body);
  await this.state.storage.put("messages", messages);
  return new Response("Message sent");
}

    if (url.pathname === "/get-messages") {
      const messages = await this.state.storage.get("messages");
      return new Response(JSON.stringify(messages || []));
    }

    return new Response("Not found", { status: 404 });
  }
}