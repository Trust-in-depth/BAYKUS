// src/endpoints/dms.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt';

// Gelen veri için basit bir tip tanımlayalım
interface OpenDmBody {
    targetUserId: string;
}
export async function handleOpenDM(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    const { targetUserId } = await request.json() as OpenDmBody; 
    const currentUserId = payload.userId; 
    
    if (!targetUserId || targetUserId === currentUserId) {
        return new Response(JSON.stringify({ error: "Geçerli bir kullanıcı ID'si gerekli." }), { status: 400 });
    }

    // 1. Mevcut DM Kanalını Kontrol Etme
    // user1_id ve user2_id kullanarak kontrol et (sıralamayı dikkate alarak)
    const checkQuery = env.BAYKUS_DB.prepare(
        "SELECT id FROM dm_channels WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)"
    );
    const checkResult = await checkQuery.bind(currentUserId, targetUserId, targetUserId, currentUserId).first('id');
    
    let dmChannelId = checkResult as string;

    // 2. Kanal Yoksa Oluşturma
    if (!dmChannelId) {
        dmChannelId = crypto.randomUUID();
        const user1 = currentUserId < targetUserId ? currentUserId : targetUserId;
        const user2 = currentUserId > targetUserId ? currentUserId : targetUserId;

        await env.BAYKUS_DB.prepare(
            "INSERT INTO dm_channels (id, user1_id, user2_id, created_at) VALUES (?, ?, ?, ?)"
        ).bind(dmChannelId, user1, user2, new Date().toISOString()).run();
    }

    // 3. Durable Object Bilgisini Hazırlama
    // PrivateChatDurableObject'in ID'sini al
    const id = env.PRIVATE_CHAT.idFromName(dmChannelId);
    
    return new Response(JSON.stringify({
        message: "DM kanalı hazır.",
        dmChannelId: dmChannelId,
        doId: id.toString() // Frontend WebSocket bağlantısı için DO ID'sini döneriz.
    }), { status: 200 });
}