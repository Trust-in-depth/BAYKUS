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



// Kullanıcının bir sunucuya katılımını yönetir
export async function handleJoinServer(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId } = await request.json() as { serverId: string };
        const userId = payload.userId;

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

        // 3. Başarılı yanıt
        return new Response(JSON.stringify({ message: "Sunucuya başarıyla katıldınız.", serverId }), { status: 200 });

    } catch (error) {
        console.error("Sunucuya katılma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}