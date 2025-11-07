export class UserMetadataDurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === "/update-metadata" && method === "POST") {
      const metadata = await request.json();
      await this.state.storage.put("metadata", metadata);
      return new Response("Metadata updated");
    }

    if (url.pathname === "/get-metadata") {
      const metadata = await this.state.storage.get("metadata");
      return new Response(JSON.stringify(metadata || {}));
    }

    return new Response("Not found", { status: 404 });
  }
}