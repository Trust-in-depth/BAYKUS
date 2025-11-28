export class PrivateChatDurableObject {
  state: DurableObjectState;
  env: Env;
  //  Aktif WebSocket bağlantılarını tutan set
    sessions: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    //  WebSocket Bağlantı Rotası (Frontend buradan bağlanır)
        if (url.pathname === "/connect" && method === "GET") {
             const [client, server] = Object.values(new WebSocketPair());
             server.accept();
             this.sessions.add(server); // Bağlantıyı kaydet

             server.addEventListener("close", () => this.sessions.delete(server));
             server.addEventListener("error", () => this.sessions.delete(server));
             
             return new Response(null, { status: 101, webSocket: client });
        }

        // 1. DM Gönderme ve YAYINLAMA
    if (url.pathname === "/send-dm" && method === "POST") {
      const body = await request.json() as any;
      const message = { ...body, timestamp: Date.now() }; // Mesaja zaman damgası

    // Kalıcılık: DM'i Durable Object Storage'a kaydet
      const raw = await this.state.storage.get("dmHistory");
      const history: any[] = Array.isArray(raw) ? raw : [];
      history.push(message);
      await this.state.storage.put("dmHistory", history);

const messageString = JSON.stringify(message);
            this.sessions.forEach(session => {
                try {
                    session.send(messageString);
                } catch (e) {
                    this.sessions.delete(session);
                }
            });

            return new Response("DM sent and broadcasted");
    }

// 2. DM Geçmişini Çekme

    if (url.pathname === "/get-dm-history") {
      const history = await this.state.storage.get("dmHistory");
      return new Response(JSON.stringify(history || []));
    }

    return new Response("Not found", { status: 404 });
  }
}