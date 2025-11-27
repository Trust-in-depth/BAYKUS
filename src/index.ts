// src/index.ts

import { fromHono } from "chanfana";
import { Hono } from "hono";

// --- 1. JWT, AUTH ve D1 API Importları ---
// Bu import'lar, Endpoint dosyalarınızdaki ve Middleware'deki fonksiyonları çeker.
import { jwtAuthMiddleware, AppContext } from "./auth/jwt_hono_middleware"; 
import { handleRegister, handleLogin } from "./endpoints/auth";
import { handleCreateServer } from "./endpoints/rooms";
import { handleAddFriend } from "./endpoints/friends";
import { handleGetTurnCredentials, handleJoinVoiceChannel, handleLeaveVoiceChannel } from "./endpoints/voice";
import { handleOpenDM } from "./endpoints/dms";
import { handleUpdateFriendStatus } from "./endpoints/friends"; 
import { handleUnfriend } from "./endpoints/friends";
import {handleJoinServer} from "./endpoints/rooms";
// --- 2. TASK Importları ---
// Hata almamak için tüm Task fonksiyonlarının ayrı dosyalardan geldiği varsayılır.
import { TaskCreate } from "./endpoints/taskCreate";
import { TaskDelete } from "./endpoints/taskDelete";
import { TaskFetch } from "./endpoints/taskFetch";
import { TaskList } from "./endpoints/taskList"; 

// --- 3. DURABLE OBJECT (DO) Sınıf Importları ---
// Bu import'lar, DO sınıflarının altının kırmızı çizilmemesi ve doğru export için zorunludur.
import { UserSessionDurableObject } from "./User_session_durable_object";
import { ChatRoomDurableObject } from "./Chat_room_durable_object";
import { NotificationDurableObject } from "./Notification_durable_object";
import { PrivateChatDurableObject } from "./Private_chat_durable_object";
import { UserMetadataDurableObject } from "./User_metadata_durable_object";
import { UserStatusDurableObject } from "./User_status_durable_object";
import { RateLimitDurableObject } from "./Rate_limit_durable_object";

// Temel yapılar
export { Room } from "./room";
import type { Env } from "./types";


// Hono uygulamasını başlat
const app = new Hono<{ Bindings: Env }>();


// --- 5. JWT KORUMASIZ ROTLAR (AUTHENTICATION) ---
app.post("/api/auth/register", async (c) => {
    return handleRegister(c.req.raw, c.env);
});

app.post("/api/auth/login", async (c) => {
    return handleLogin(c.req.raw, c.env);
});


app.post("/notify/track", async (c) => {
    // "global" adını kullanarak tek bir Notification DO örneğini adresliyoruz
    const id = c.env.NOTIFICATION.idFromName("global"); 
    const stub = c.env.NOTIFICATION.get(id);
    
    // DO'nun kendi içindeki /track rotasına isteği yönlendir
    // c.req.raw kullanarak orijinal isteği olduğu gibi iletmek en temizidir.
    return stub.fetch(c.req.raw); 
});

app.get("/notify/count", async (c) => {
    // Aynı 'global' DO örneğinden sayacı çek
    const id = c.env.NOTIFICATION.idFromName("global");
    const stub = c.env.NOTIFICATION.get(id);
    
    // c.req.raw kullanarak orijinal isteği olduğu gibi ilet
    return stub.fetch(c.req.raw); 
});

// Kök dizini (/) için kendi rotamızı tanımla
app.get('/', (c) => c.text('Baykuş Workers Aktif ve Frontend Entegrasyonuna Hazır!'));
//app.get('/docs', (c) => c.text('Hono!'));




// --- 3. JWT KORUMALI ROTLAR (MIDDLEWARE UYGULAMASI) ---
// Tüm /api/* rotalarına JWT kontrolünü uygular.
app.use('/api/*', jwtAuthMiddleware); 

// 4. ADIM: OpenAPI Rotasını /docs'a Taşıma ve Kök Rotayı Tanımlama
// Kök dizin (/) artık Backend'in çalıştığını gösterecek.
const openapi = fromHono(app, {
  docs_url: "/docs", // Dokümantasyon /docs adresine taşındı.
});

// Tasks rotaları (OpenAPI'de kalır)
openapi.get("/api/tasks", TaskList);
openapi.post("/api/tasks", TaskCreate);
openapi.get("/api/tasks/:taskSlug", TaskFetch);
openapi.delete("/api/tasks/:taskSlug", TaskDelete);



// 6A. D1 ve DO YÖNLENDİRMELERİ (Geliştirdiklerimiz)
// Bu rotalar AppContext kullanır ve JWT ile doğrulanan payload'ı alır.
// NOT: Bu rotalar, tip güvenliği için artık raw Request yerine AppContext kullanıyor.

// Sunucu/Oda Oluşturma
app.post("/api/rooms/create", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleCreateServer(c.req.raw, c.env, payload);
});

// Yeni Arkadaşlık Durumu Güncelleme Rotası (Accept/Reject/Block işlemleri için)
app.post("/api/friends/update", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleUpdateFriendStatus(c.req.raw, c.env, payload);
});

// Arkadaş Ekleme
app.post("/api/friends/add", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleAddFriend(c.req.raw, c.env, payload);
});


// Arkadaşlıktan Çıkarma Rotası (Unfriend)
app.post("/api/friends/unfriend", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleUnfriend(c.req.raw, c.env, payload);
});

// DM Kanalı Açma (D1 ve PrivateChat DO)
app.post("/api/dm/open", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleOpenDM(c.req.raw, c.env, payload);
});

// Sesli İletişim Bilgileri (TURN/STUN)
app.get("/api/voice/credentials", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleGetTurnCredentials(c.req.raw, c.env, payload);
});

// Sesli Kanala Giriş/Ayrılma (D1 voice_activity)
app.post("/api/voice/join", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleJoinVoiceChannel(c.req.raw, c.env, payload);
});
app.post("/api/voice/leave", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleLeaveVoiceChannel(c.req.raw, c.env, payload);
});


// src/index.ts içinde, JWT korumalı rotalara ekleyin
app.post("/api/servers/join", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleJoinServer(c.req.raw, c.env, payload);
});

// 6B. GÜVENLİ DO YÖNLENDİRMELERİ (MEVCUT KODUN GÜVENLİ HALE GETİRİLMİŞİ)
// Mevcut DO rotaları artık JWT koruması altındadır ve /api/* altında çalışır.

// Sohbet Mesajı Gönderme (ChatRoom DO)
app.post("/api/chat/send", async (c: AppContext) => {
    const body = await c.req.json();
    const payload = c.get('userPayload'); // JWT'den gelen kullanıcı ID'si
    
    const id = c.env.CHAT_ROOM.idFromName(body.roomId);
    const stub = c.env.CHAT_ROOM.get(id);

    // Güvenli User ID'yi DO'ya gönder
    await stub.fetch("http://do/send-message", { 
        method: "POST", 
        headers: { 'X-User-ID': payload.userId }, 
        body: JSON.stringify(body) 
    });
    return c.text("Message sent");
});

// ... (Diğer tüm mevcut DO rotaları benzer şekilde AppContext ile güncellenmeli ve /api/* altına taşınmalıdır.) ...


// --- 7. EXPORTLAR (DOĞRU VE TAM) ---
// DO sınıflarının dışarı aktarımı bu şekilde olmalıdır.
export { UserSessionDurableObject };
export { ChatRoomDurableObject };
export { NotificationDurableObject };
export { PrivateChatDurableObject };
export { UserMetadataDurableObject };
export { UserStatusDurableObject };
export { RateLimitDurableObject };
export default app;