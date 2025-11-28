import type { Env } from '../src/types.ts';
export class ChatRoomDurableObject {
  state: DurableObjectState;
  env: Env;
// YENİ: Aktif WebSocket bağlantılarını tutan set
    sessions: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // YENİ: WebSocket Bağlantı Rotası (Frontend buradan bağlanır)
        if (url.pathname === "/connect" && method === "GET") {
            const [client, server] = Object.values(new WebSocketPair());
            server.accept();
            this.sessions.add(server); // Bağlantıyı oturumlara kaydet

            // Bağlantı kapandığında oturumu Set'ten kaldır
            server.addEventListener("close", () => this.sessions.delete(server));
            server.addEventListener("error", () => this.sessions.delete(server));
            
            return new Response(null, { status: 101, webSocket: client });
        }

// 1. Mesaj Gönderme ve YAYINLAMA
  if (url.pathname === "/send-message" && method === "POST") {
  const body = await request.json()as any;
  const message = { ...body, timestamp: Date.now() }; // Mesaja zaman damgası 
 
  // Kalıcılık: Mesajı Durable Object Storage'a kaydet
  const messagesToKeep = 500;
  const raw = await this.state.storage.get("messages");
  const messages = Array.isArray(raw) ? raw : [];
  messages.push(message);

  if (messages.length > messagesToKeep) {
            // Mesaj sayısı limiti aştıysa, eski mesajları R2'ye arşivle
            const messagesToArchive = messages.splice(0, messages.length - messagesToKeep);
            
            // Asenkron Delege Etme (await kullanmıyoruz, böylece chatroom engellenmez)
            // JSON'ı göndermek için bir POST isteği oluşturuyoruz.
            const archiveRequest = new Request("http://archive-worker/archive/messages", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    roomId: this.state.id.toString(), // Hangi odaya ait olduğunu belirt
                    messages: messagesToArchive 
                })
            });
// KRİTİK: await KULLANMAYIN! Workers'ın görevi bitirmeden bu isteği göndermesini sağlayın.
            // Bu, işlem yapsa bile CHATROOM'U ENGELLEMEZ.
            this.env.ARCHIVE_WORKER.fetch(archiveRequest) 
                .then(response => {
                    if (!response.ok) {
                        console.error("Arşivleyiciye gönderme hatası!");
                    }
                })
                .catch(err => console.error("Arşivleyici servisine ulaşılamadı:", err));

            // Not: Mesajların güncel listesini tekrar kaydet
            await this.state.storage.put("messages", messages);
        }



// Mesajı tüm bağlı WebSocket oturumlarına yayınla
            const messageString = JSON.stringify(message);
            this.sessions.forEach(session => {
                try {
                    session.send(messageString);
                } catch (e) {
                    this.sessions.delete(session);
                }
            });
            return new Response("Message sent and broadcasted");
}

// 2. Mesaj Geçmişini Çekme
    if (url.pathname === "/get-messages") {
      const messages = await this.state.storage.get("messages");
      return new Response(JSON.stringify(messages || []));
    }

    return new Response("Not found", { status: 404 });
  }
}