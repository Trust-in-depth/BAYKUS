// NotificationDurableObject.ts (Güncellenmiş Sürüm)

export class NotificationDurableObject {
    state: DurableObjectState;
    env: Env;
    
    // YENİ: Bu DO'yu dinleyen tüm aktif WebSocket bağlantılarını tutar.
    sessions: Set<WebSocket> = new Set(); 

    constructor(state: DurableObjectState, env: Env) {
        this.state = state;
        this.env = env;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // --- 1. YENİ: WebSocket Bağlantı Noktası (/do/notify/connect) ---
        // Frontend, bu rota üzerinden DO'ya bağlanarak bildirimleri dinler.
        if (url.pathname === "/do/notify/connect" && request.method === "GET") {
            const [client, server] = Object.values(new WebSocketPair());
            
            // Yeni WebSocket oturumunu kaydet
            server.accept();
            this.sessions.add(server);

            // Bağlantı kapandığında oturumu Set'ten kaldır
            server.addEventListener("close", () => this.sessions.delete(server));
            server.addEventListener("error", () => this.sessions.delete(server));
            
            return new Response(null, { status: 101, webSocket: client });
        }


        // --- 2. YENİ: Olay Yayınlama Rotası (/do/notify/presence) ---
        // Workers API'sinden (handleJoinServer gibi) gelen POST isteklerini işler.
        if (url.pathname === "/do/notify/presence" && request.method === "POST") {
            const message = await request.json();
            
            // Bildirimi tüm bağlı istemcilere yayınla (Broadcast)
            const messageString = JSON.stringify(message);

            this.sessions.forEach(session => {
                try {
                    session.send(messageString); // Yayınlama gerçekleşir
                } catch (e) {
                    this.sessions.delete(session);
                }
            });
            
            return new Response("Notification broadcasted", { status: 200 });
        }


        // --- 3. MEVCUT SAYACA AİT ROTLAR (İsteğe bağlı olarak kalabilir) ---
        if (url.pathname === "/track" && request.method === "POST") {
            // ... (Mevcut sayaç mantığı)
        }
        if (url.pathname === "/get-count") {
            // ... (Mevcut sayaç mantığı)
        }
        
        return new Response("Not found", { status: 404 });
    }
}