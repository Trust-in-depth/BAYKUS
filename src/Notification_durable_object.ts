// NotificationDurableObject.ts (Düzeltilmiş Rota Tanımları)

export class NotificationDurableObject {
    state: DurableObjectState;
    env: Env;
    sessions: Set<WebSocket> = new Set(); 

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // --- 1. WebSocket Bağlantı Noktası (KISA ROTA) ---
        // /do/notify/connect yerine sadece /connect beklenir.
        if (url.pathname === "/connect" && request.method === "GET") {
            const [client, server] = Object.values(new WebSocketPair());
            
            server.accept();
            this.sessions.add(server);

            server.addEventListener("close", () => this.sessions.delete(server));
            server.addEventListener("error", () => this.sessions.delete(server));
            
            return new Response(null, { status: 101, webSocket: client });
        }


        // --- 2. Olay Yayınlama Rotası (KISA ROTA) ---
        // /do/notify/presence yerine sadece /presence beklenir.
        if (url.pathname === "/presence" && request.method === "POST") {
            const message = await request.json();
            
            const messageString = JSON.stringify(message);

            this.sessions.forEach(session => {
                try {
                    session.send(messageString); 
                } catch (e) {
                    this.sessions.delete(session);
                }
            });
            
            return new Response("Notification broadcasted", { status: 200 });
        }


        // --- 3. MEVCUT SAYACA AİT ROTLAR (DOĞRU KISA ROTA) ---
        if (url.pathname === "/track" && request.method === "POST") {
             // ... (Mevcut sayaç mantığı)
             // ... [Burası zaten kısayoldu]
             
             return new Response("Tracked", { status: 200 }); // Varsayımsal dönüş
        }
        if (url.pathname === "/get-count") {
             // ... (Mevcut sayaç mantığı)
             return new Response(JSON.stringify({ count: 1 }), { status: 200 }); // Varsayımsal dönüş
        }
        
        // Önemli: Bu alana ulaşıldığında artık 404 dönmeli.
        return new Response("Not found", { status: 404 });
    }
}