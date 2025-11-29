
// src/endpoints/dms.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt';

// ... (Gerekli interface'ler: UpdateBody, AddFriendBody vb.) ...

export async function handleOpenDM(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { targetUserId } = await request.json() as { targetUserId: string }; // Konuşulacak kişinin ID'si
        const currentUserId = payload.userId;

        if (!targetUserId || targetUserId === currentUserId) {
            return new Response(JSON.stringify({ error: "Geçerli bir kullanıcı ID'si gerekli." }), { status: 400 });
        }

        // 1. Mevcut DM Kanalını Kontrol Etme/Oluşturma (D1'de dm_channels tablosu)
        const checkQuery = env.BAYKUS_DB.prepare(
            "SELECT id FROM dm_channels WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)"
        );
        // ID'leri sıralayarak UNQIUE kısıtlamasına uyum sağlar
        const user1 = currentUserId < targetUserId ? currentUserId : targetUserId;
        const user2 = currentUserId > targetUserId ? currentUserId : targetUserId;
        
        const checkResult = await checkQuery.bind(user1, user2, user2, user1).first('id');
        
        let dmChannelId = checkResult as string;

        // 2. Kanal Yoksa Oluşturma (Yeni bir kayıt ekleme)
        if (!dmChannelId) {
            dmChannelId = crypto.randomUUID();
            await env.BAYKUS_DB.prepare(
                "INSERT INTO dm_channels (id, user1_id, user2_id, created_at) VALUES (?, ?, ?, ?)"
            ).bind(dmChannelId, user1, user2, new Date().toISOString()).run();
        }

        // 3. Durable Object'i Adresleme
        // PrivateChat DO'sunu DM Kanal ID'si ile adresle (Bu, Frontend'in bağlanacağı adrestir)
        const id = env.PRIVATE_CHAT.idFromName(dmChannelId);
        
        // 4. Başarılı yanıt: Frontend'e DM kanalının ID'si ve DO adresi gönderilir.
        return new Response(JSON.stringify({
            message: "Özel sohbet kanalı hazır.",
            dmChannelId: dmChannelId,
            doId: id.toString()
        }), { status: 200 });

    } catch (error) {
        console.error("DM açma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}
