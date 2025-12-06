// src/index.ts

import { fromHono } from "chanfana";
import { Hono } from "hono";

// --- 1. JWT, AUTH ve D1 API Importları ---
// Bu import'lar, Endpoint dosyalarınızdaki ve Middleware'deki fonksiyonları çeker.
import { handleRegister, handleLogin } from "./endpoints/auth";
import { handleCreateServer, handleDeleteServer } from "./endpoints/rooms";
import { handleAddFriend } from "./endpoints/friends";
import { handleGetTurnCredentials, handleJoinVoiceChannel, handleLeaveVoiceChannel } from "./endpoints/voice";
import { handleOpenDM } from "./endpoints/dms";
import { handleUpdateFriendStatus } from "./endpoints/friends"; 
import { handleUnfriend } from "./endpoints/friends";
import {handleJoinServer} from "./endpoints/rooms";
import { handleLeaveServer } from "./endpoints/rooms";
import { jwtAuthMiddleware, AppContext } from "./auth/jwt_hono_middleware"; 
import { handleFileUpload } from "./endpoints/files";
import { handleCreateGroup } from "./endpoints/groups";
import { handleCreateChannel } from "./endpoints/channels";
import { handleUpdateChannel } from "./endpoints/channels";
import { handleDeleteChannel } from "./endpoints/channels";



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
import { verifyAndDecodeJwt } from "./auth/jwt";


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
    
    // DÜZELTME: İsteğin URL'sini yeniden yazın (DO sadece "/track" bekliyor)
    const newUrl = new URL(c.req.url);
    newUrl.pathname = "/track"; 
    
    // Yeni, kısa URL'li Request nesnesini oluştur ve DO'ya gönder
    const newRequest = new Request(newUrl.toString(), c.req.raw);
    return stub.fetch(newRequest); 
});

app.get("/notify/count", async (c) => {
    // Aynı 'global' DO örneğinden sayacı çek
    const id = c.env.NOTIFICATION.idFromName("global");
    const stub = c.env.NOTIFICATION.get(id);
    
    // DÜZELTME: İsteğin URL'sini yeniden yazın (DO sadece "/get-count" bekliyor)
    const newUrl = new URL(c.req.url); 
    newUrl.pathname = "/get-count";
    
    // Yeni, kısa URL'li Request nesnesini oluştur ve DO'ya gönder
    const newRequest = new Request(newUrl.toString(), c.req.raw);
    return stub.fetch(newRequest); 
});

// Kök dizini (/) için kendi rotamızı tanımla
app.get('/', (c) => c.text('Baykuş Workers Aktif ve Frontend Entegrasyonuna Hazır!'));
app.get('/docs', (c) => c.text('Hono!'));




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
app.post("/api/servers/create", async (c: AppContext) => {
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
// Sunucuya Katılma Rotası
app.post("/api/servers/join", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleJoinServer(c.req.raw, c.env, payload);
});

// Sunucudan Ayrılma Rotası
app.post("/api/servers/leave", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleLeaveServer(c.req.raw, c.env, payload);
});


// Sunucu Silme Rotası
app.post("/api/servers/delete", async (c: AppContext) => {
    const payload = c.get('userPayload'); // Yetkili kullanıcıyı al
    return handleDeleteServer(c.req.raw, c.env, payload);
});



// 6B. DURABLE OBJECT (DO) YÖNLENDİRMELERİ 
// Mevcut DO rotaları artık JWT koruması altındadır ve /api/* altında çalışır.

// Sohbet Mesajı Gönderme (ChatRoom DO)
app.post("/api/chat/send", async (c: AppContext) => {
     // JWT'den gelen kullanıcı kimliğini al
    const payload = c.get('userPayload'); 
    // Mesaj gövdesini ve oda ID'sini al
    const body = await c.req.json();
    // Güvenlik kontrolü
    if (!body.roomId || !body.content) {
         return c.json({ error: "Oda ve içerik gerekli." }, 400);}

         // 1. Mesajın temel yapısını oluştur
    const messageData: any = { // Geçici olarak 'any' kullanıyoruz
        content: body.content,
        username: payload.username, 
        timestamp: Date.now(),
    };
    
    if (body.attachmentUrl) {
        messageData.attachmentUrl = body.attachmentUrl;
    }

    // 1. ChatRoom Durable Object'i adresle
    const id = c.env.CHAT_ROOM.idFromName(body.roomId);
    const stub = c.env.CHAT_ROOM.get(id);

    // 2. Mesajı DO'ya ilet (DO'nun /send-message rotasını tetikler)
    await stub.fetch("http://do/send-message", { 
        method: "POST", 
        // DO'ya mesajı gönderenin kimliğini iletiyoruz
        headers: { 'X-User-ID': payload.userId }, 
        body: JSON.stringify(messageData)
    });
    // Yanıt dön
    return c.text("Message sent");
});


// --- YENİ: WEBSOCKET SİNYALLEŞME ROTASI (GENEL KANAL BAĞLANTISI) ---
app.get("/ws/chat/:channelId", async (c: AppContext) => {
 // 1. Yetkilendirme (JWT) Kontrolü
    const url = new URL(c.req.url);
    
    // KRİTİK DÜZELTME: JWT'yi sorgu parametresinden al
    const token = url.searchParams.get('token'); 
    if (!token) {
        return c.json({ error: "Yetkilendirme token'ı eksik." }, 401);
    }
    // JWT'yi çözmek için verifyAndDecodeJwt fonksiyonunu çağırın
    const payload = await verifyAndDecodeJwt(token, c.env); 
    if (!payload) {
        // Eğer JWT geçerli değilse, WebSocket bağlantısını reddet
        return c.json({ error: "Geçersiz veya süresi dolmuş token." }, 401);
    }
    // 2. Durable Object'i Adresleme
    const channelId = c.req.param("channelId");
    const id = c.env.CHAT_ROOM.idFromName(channelId);
    const stub = c.env.CHAT_ROOM.get(id);
    // 3. Bağlantıyı DO'ya Transfer Etme
    // DO'nun kendi içindeki /connect rotasına yönlendiriyoruz
    const doUrl = new URL(c.req.url); 
    doUrl.pathname = "/connect"; // DO'nun beklediği kısa rota

    // Worker, gelen Request nesnesini DO'ya iletmelidir.

    // Yeni Request nesnesi oluştur (Güvenli ID'yi başlığa ekleyerek)
    const newRequest = new Request(doUrl.toString(), c.req.raw);
    newRequest.headers.set('X-User-ID', payload.userId);
    newRequest.headers.set('X-Username', payload.username);
    // İsteği DO'ya yönlendir
    return stub.fetch(newRequest);
});

// Yeni Grup Oluşturma Rotası
app.post("/api/groups/create", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleCreateGroup(c.req.raw, c.env, payload);
});


// YENİ DM GÖNDERME ROTASI
app.post("/api/dm/send", async (c: AppContext) => {
    const payload = c.get('userPayload'); // JWT'den yetkili kullanıcıyı al
    const body = await c.req.json();
    
    // Güvenlik kontrolü
    if (!body.roomId || !body.content) {
         return c.json({ error: "Oda ve içerik gerekli." }, 400);
    }
    
    // 1. PrivateChat Durable Object'i adresle
    // Not: DM'ler için roomId (dmChannelId) kullanılır
    const id = c.env.PRIVATE_CHAT.idFromName(body.roomId); 
    const stub = c.env.PRIVATE_CHAT.get(id);

    // 2. Mesajı DO'ya ilet (DO'nun /send-dm rotasını tetikler)
    await stub.fetch("http://do/send-dm", { 
        method: "POST", 
        headers: { 'X-User-ID': payload.userId }, 
        body: JSON.stringify({ 
            content: body.content,
            username: payload.username, 
            timestamp: Date.now()
        })
    });
    
    return c.text("DM sent");
});

// --- YENİ: WEBSOCKET SİNYALLEŞME ROTASI (ÖZEL DM KANALI BAĞLANTISI) ---
app.get("/ws/dm/:channelId", async (c: AppContext) => {
    
    // 1. Yetkilendirme Kontrolü (Aynı JWT mantığı kullanılır)
    const url = new URL(c.req.url);
    const token = url.searchParams.get('token'); 

    if (!token) { return c.json({ error: "Yetkilendirme token'ı eksik." }, 401); }
    const payload = await verifyAndDecodeJwt(token, c.env); 
    if (!payload) { return c.json({ error: "Geçersiz token." }, 401); }
    
    // 2. PrivateChat Durable Object'i Adresleme (Farklı DO)
    const channelId = c.req.param("channelId");
    const id = c.env.PRIVATE_CHAT.idFromName(channelId); // <<< PRIVATE_CHAT adreslendi
    const stub = c.env.PRIVATE_CHAT.get(id);

    // 3. Bağlantıyı DO'ya Transfer Etme (Aynı mantık)
    const doUrl = new URL(c.req.url); 
    doUrl.pathname = "/connect"; 

    const newRequest = new Request(doUrl.toString(), c.req.raw);
    newRequest.headers.set('X-User-ID', payload.userId);
    newRequest.headers.set('X-Username', payload.username);

    return stub.fetch(newRequest);
});

// Dosya Yükleme Rotası (R2'ye yükler)
app.post("/api/files/upload", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleFileUpload(c.req.raw, c.env, payload);
});

// --- 6C. KANAL YÖNETİMİ ROTASI (channels.ts dosyasından gelmeli) ---

// Yeni Kanal Oluşturma Rotası (handleCreateChannel)
app.post("/api/channels/create", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleCreateChannel(c.req.raw, c.env, payload);
});

// Kanal Güncelleme Rotası (handleUpdateChannel)
app.post("/api/channels/update", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleUpdateChannel(c.req.raw, c.env, payload);
});

// Kanal Silme Rotası (handleDeleteChannel)
app.post("/api/channels/delete", async (c: AppContext) => {
    const payload = c.get('userPayload');
    return handleDeleteChannel(c.req.raw, c.env, payload);
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