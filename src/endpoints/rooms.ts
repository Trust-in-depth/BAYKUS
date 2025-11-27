// src/endpoints/rooms.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt'; 

// Gelen JSON gövdesinin yapısını tanımlıyoruz
interface CreateServerBody {
    serverName: string;
}

export async function handleCreateServer(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverName } = await request.json() as CreateServerBody;
        if (!serverName) {
            return new Response(JSON.stringify({ error: "Sunucu adı gerekli." }), { status: 400 });
        }
        
        const serverId = crypto.randomUUID();
        const ownerId = payload.userId;

        // 1. D1'e Sunucuyu Kaydetme (servers tablosu)
        const serverQuery = env.BAYKUS_DB.prepare(
            "INSERT INTO servers (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)"
        );
        await serverQuery.bind(serverId, serverName, ownerId, new Date().toISOString()).run();

        // 2. Kullanıcıyı Sunucu Üyesi Yapma (server_members tablosu)
        await env.BAYKUS_DB.prepare(
            "INSERT INTO server_members (id, server_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(crypto.randomUUID(), serverId, ownerId, 'owner', new Date().toISOString()).run();

        // 3. Varsayılan Kanal Ekleme (channels tablosu)
        const defaultChannelId = crypto.randomUUID();
        await env.BAYKUS_DB.prepare(
            "INSERT INTO channels (id, server_id, name, type, topic, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(defaultChannelId, serverId, 'genel-sohbet', 'text', 'Sohbetin başladığı yer.', new Date().toISOString()).run();

        return new Response(JSON.stringify({ 
            message: "Sunucu oluşturuldu.", 
            serverId: serverId,
            defaultChannelId: defaultChannelId,
        }), { status: 201 });

    } catch (error) {
        console.error("Sunucu oluşturma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}


// src/endpoints/rooms.ts (handleJoinServer fonksiyonunun Düzeltilmiş Hali)

// Kullanıcının bir sunucuya katılımını yönetir
export async function handleJoinServer(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId } = await request.json() as { serverId: string };
        const userId = payload.userId;
        const username = payload.username || 'Bilinmeyen Kullanıcı'; // Kullanıcı adını yayınlamak için al

        if (!serverId) {
            return new Response(JSON.stringify({ error: "Sunucu ID'si gerekli." }), { status: 400 });
        }

        // 1. Zaten üye mi kontrol et
        const existingMember = await env.BAYKUS_DB.prepare(
            "SELECT id FROM server_members WHERE server_id = ? AND user_id = ?"
        ).bind(serverId, userId).first('id');

        if (existingMember) {
            return new Response(JSON.stringify({ message: "Zaten bu sunucunun üyesisiniz." }), { status: 200 });
        }

        // 2. server_members tablosuna kayıt ekle
        await env.BAYKUS_DB.prepare(
            "INSERT INTO server_members (id, server_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(crypto.randomUUID(), serverId, userId, 'member', new Date().toISOString()).run();
        
        // --- 3. Notification Durable Object'e yayınlama (broadcast) isteği gönderme (Presence) ---

        // Bildirim verisi (Consistent Presence Payload)
        const messagePayload = {
            type: "PRESENCE_UPDATE",
            data: {
                action: "JOIN", // Katılma eylemi
                userId: userId,
                username: username,
                serverId: serverId,
                timestamp: Date.now()
            }
        };

        // YENİ MANTIK: Sadece global Notification DO'ya tek bir istek gönder
        const notificationId = env.NOTIFICATION.idFromName("global"); // SADECE GLOBAL DO KULLANILIR
        const notificationStub = env.NOTIFICATION.get(notificationId);

        // DO'nun beklediği kısa rota: "/presence" (DO'ya yönlendirme için URL oluşturulur)
        const doUrl = new URL("http://do/presence"); 
        
        // Tek bir POST isteği ile global NDO'yu tetikle
        await notificationStub.fetch(doUrl.toString(), {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messagePayload),
        }).catch(e => console.error(`Katılım bildirimi yayınlanırken hata oluştu:`, e));


        // 4. Başarılı yanıt
        return new Response(JSON.stringify({ 
            message: "Sunucuya başarıyla katıldınız.", 
            serverId,
            broadcast_status: "Katılım bildirimi yayınlandı."
        }), { status: 200 });

    } catch (error) {
        console.error("Sunucuya katılma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}

// src/endpoints/rooms.ts (handleLeaveServer fonksiyonunun Düzeltilmiş Hali)

export async function handleLeaveServer(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        // Sunucu ID'si alınır
        const { serverId } = await request.json() as { serverId: string };
        const userId = payload.userId;
        const username = payload.username || 'Bilinmeyen Kullanıcı'; // Payload'da username olduğunu varsayıyoruz

        if (!serverId) {
            return new Response(JSON.stringify({ error: "Sunucu ID'si gerekli." }), { status: 400 });
        }

        // --- 1. D1'den üyelik kaydını silme ---
        const deleteQuery = env.BAYKUS_DB.prepare(
            "DELETE FROM server_members WHERE server_id = ? AND user_id = ?"
        );
        
        const result = await deleteQuery.bind(serverId, userId).run();
        const changes = (result as any).changes || 0;

        if (changes === 0) {
            return new Response(JSON.stringify({ error: "Bu sunucuda aktif üyelik bulunamadı." }), { status: 404 });
        }
        
        // --- 2. Notification Durable Object'e yayınlama (broadcast) isteği gönderme ---
        
        // Bildirim verisi (Consistent Presence Payload)
        const messagePayload = {
            type: "PRESENCE_UPDATE",
            data: {
                action: "LEAVE", // Ayrılma eylemi
                userId: userId,
                username: username,
                serverId: serverId,
                timestamp: Date.now()
            }
        };

        // Notification DO'ya yönlendirme
        const notificationId = env.NOTIFICATION.idFromName("global");
        const notificationStub = env.NOTIFICATION.get(notificationId);

        // ÖNEMLİ: DO'nun beklediği kısa rota: "/presence" (Daha önce NDO'da bu şekilde düzeltilmişti)
        const doUrl = new URL("http://do/presence"); 
        
        await notificationStub.fetch(doUrl.toString(), {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messagePayload),
        });

        // --- 3. Başarılı yanıtı döndürme ---
        return new Response(JSON.stringify({ 
            message: "Sunucudan başarıyla ayrıldınız.",
            broadcast_status: "Ayrılma bildirimi yayınlandı."
        }), { status: 200 });

    } catch (error) {
        console.error("Sunucudan ayrılma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}