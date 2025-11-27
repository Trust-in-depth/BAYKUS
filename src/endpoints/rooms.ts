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

// src/endpoints/rooms.ts (handleJoinServer)

// Not: Bu kodun çalışması için 'AuthPayload' ve 'CreateServerBody' interface'lerinin tanımlı olması gerekir.
export async function handleJoinServer(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId } = await request.json() as { serverId: string };
        const userId = payload.userId;
        const username = payload.username || 'Bilinmeyen Kullanıcı'; 

        if (!serverId) {
            return new Response(JSON.stringify({ error: "Sunucu ID'si gerekli." }), { status: 400 });
        }

        // 1. Zaten AKTİF üye mi kontrol et
        const existingActiveMember = await env.BAYKUS_DB.prepare(
            "SELECT id FROM server_members WHERE server_id = ? AND user_id = ? AND left_at IS NULL"
        ).bind(serverId, userId).first('id');

        if (existingActiveMember) {
            return new Response(JSON.stringify({ message: "Zaten bu sunucunun aktif üyesisiniz." }), { status: 200 });
        }

        // 2. PASİF kaydı varsa SİL (UNIQUE hatasını önlemek için)
        await env.BAYKUS_DB.prepare(
            "DELETE FROM server_members WHERE server_id = ? AND user_id = ?"
        ).bind(serverId, userId).run();
        
        // 3. YENİ AKTİF KAYIT EKLE (İlk katılım veya tekrar katılım)
        await env.BAYKUS_DB.prepare(
            "INSERT INTO server_members (id, server_id, user_id, role, joined_at, left_at) VALUES (?, ?, ?, ?, strftime('%s','now'), NULL)"
        ).bind(crypto.randomUUID(), serverId, userId, 'member').run(); 
        
        // 4. NDO Bildirimi gönderilir (JOIN)
        // ... (Notification Durable Object'e yayınlama mantığı buraya gelir) ...
        
        return new Response(JSON.stringify({ message: "Sunucuya başarıyla katıldınız.", serverId }), { status: 200 });

    } catch (error) {
        console.error("Sunucuya katılma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}

// 2. Sunucudan Ayrılma Fonksiyonu (handleLeaveServer)

//Bu fonksiyon, üyeliği silmek yerine **Soft Delete** yapar (`left_at` sütununu günceller) ve ardından **NDO'ya LEAVE mesajını** gönderir.

//typescript
// src/endpoints/rooms.ts (handleLeaveServer)

export async function handleLeaveServer(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId } = await request.json() as { serverId: string };
        const userId = payload.userId;
        const username = payload.username || 'Bilinmeyen Kullanıcı';

        if (!serverId) {
            return new Response(JSON.stringify({ error: "Sunucu ID'si gerekli." }), { status: 400 });
        }

        // 1. Soft Delete (left_at'i mevcut zamanla güncelle)
        const updateQuery = env.BAYKUS_DB.prepare(
            // SQL'in kendi zamanını kullanarak tip uyuşmazlığı hatasını önlüyoruz
            "UPDATE server_members SET left_at = strftime('%s','now') WHERE server_id = ? AND user_id = ? AND left_at IS NULL" 
        );
        
        // Bind metodunda sadece serverId ve userId kullanılır.
        const result = await updateQuery.bind(serverId, userId).run();
        const changes = (result as any).changes || 0; // Etkilenen satır sayısını kontrol et

        if (changes === 0) {
            // Hiçbir aktif kayıt güncellenmediyse (ya zaten ayrılmıştır ya da üye değildir).
            return new Response(JSON.stringify({ error: "Bu sunucuda aktif üyelik bulunamadı." }), { status: 404 });
        }
        
        // 2. Notification Durable Object'e yayınlama (broadcast) isteği gönderme (LEAVE)
        // ... (NDO yayınlama kodu buraya gelir) ...

        return new Response(JSON.stringify({ message: "Sunucudan başarıyla ayrıldınız.", serverId }), { status: 200 });

    } catch (error) {
        console.error("Sunucudan ayrılma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}