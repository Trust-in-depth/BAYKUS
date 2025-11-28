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
            "SELECT id FROM server_members WHERE server_id = ? AND user_id = ? AND left_at IS NULL"
        ).bind(serverId, userId).first('id');

        if (existingMember) {
            return new Response(JSON.stringify({ message: "Zaten bu sunucunun üyesisiniz." }), { status: 200 });
        }

     // 2. ADIM: Daha önce ayrılmış bir kayıt var mı kontrol et (Pasif Kayıt)
const previousMember = await env.BAYKUS_DB.prepare(
    "SELECT id FROM server_members WHERE server_id = ? AND user_id = ?"
).bind(serverId, userId).first('id');


if (previousMember) {
    // Kayıt VARDI (pasif). UPDATE ile aktif hale getir (Soft Un-Delete).
    await env.BAYKUS_DB.prepare(
        "UPDATE server_members SET left_at = NULL, joined_at = ? WHERE id = ?"
    ).bind(new Date().toISOString(), previousMember).run();
    
    // NDO Bildirimi gönderilir (JOIN)
    // ... (NDO yayınlama kodu buraya gelecek) ...
    
    return new Response(JSON.stringify({ message: "Sunucuya başarıyla katıldınız (yeniden aktif edildi)." }), { status: 200 });

} else {
    // Kayıt HİÇ YOKTU. YENİ KAYIT EKLE (İlk katılım)
    await env.BAYKUS_DB.prepare(
        "INSERT INTO server_members (id, server_id, user_id, role, joined_at, left_at) VALUES (?, ?, ?, ?, ?, NULL)"
    ).bind(crypto.randomUUID(), serverId, userId, 'member', new Date().toISOString()).run();
    

        // 2A. Bildirim DO'ya katılım bilgisini gönder
        // YENİ MANTIK: Diğer üyelere Bob'un katıldığını bildirme (Presence)
        // 1. Sunucudaki diğer aktif kullanıcıların ID'lerini D1'den çekmeliyiz
        const memberIdsResult = await env.BAYKUS_DB.prepare(
            "SELECT user_id FROM server_members WHERE server_id = ? AND user_id != ?"
        ).bind(serverId, userId).all(); // Yeni katılan kişi (userId) hariç herkesi çek

        const memberIds = memberIdsResult.results.map((r: any) => r.user_id);

        // 2. Her üyeye bildirim göndermek için döngü
        for (const memberId of memberIds) {
            // Her üyenin kendi Notification DO'sunu adresle
            const notificationId = env.NOTIFICATION.idFromName(memberId);
            const stub = env.NOTIFICATION.get(notificationId);

            // Notification DO'suna POST isteği gönder (broadcast etmesi için)
            await stub.fetch("http://do/notify/presence", { // <-- Notification DO'sundaki rotanız
                method: 'POST',
                body: JSON.stringify({
                    type: 'USER_JOINED_SERVER',
                    userId: userId, // Katılan kişi
                    serverId: serverId,
                    username: payload.username // Katılanın kullanıcı adı
                })
            }).catch(e => console.error(`Bildirim gönderilemedi: ${memberId}`));
        }

        // 3. Başarılı yanıt
        return new Response(JSON.stringify({ message: "Sunucuya başarıyla katıldınız.", serverId }), { status: 200 });
    }
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

// --- 1. D1'de üyeliği Soft Delete yapma ---
        // Kaydı silmek yerine left_at sütununu güncelle
// 1. Üyeliği bul ve güncelle. left_at IS NULL olan kaydı arıyoruz.
const updateQuery = env.BAYKUS_DB.prepare(
            "UPDATE server_members SET left_at = strftime('%s','now') WHERE server_id = ? AND user_id = ? AND left_at IS NULL"
        );
        
        // Sorguyu çalıştır ve etkilenen satır sayısını al (changes)
        const result = await updateQuery.bind(serverId, userId).run();
        const changes = (result as any).changes || 0;

        // 2. Kontrol: Eğer hiçbir satır etkilenmediyse (changes === 0)
        if (changes === 0) {
            // Bu, kaydın left_at IS NULL OLMADIĞI (yani zaten ayrıldığı) anlamına gelir.
            return new Response(JSON.stringify({ error: "Bu sunucuda aktif üyelik bulunamadı." }), { status: 404 });
        }
        
        // --- 2. Notification Durable Object'e yayınlama (broadcast) isteği gönderme ---
        
       const memberIdsResult = await env.BAYKUS_DB.prepare(
    "SELECT user_id FROM server_members WHERE server_id = ?"
).bind(serverId).all();

const memberIds = memberIdsResult.results.map((r: any) => r.user_id);

// 2. Her üyeye bildirim göndermek için döngü
const messagePayload = { /* ... LEAVE verileri ... */ }; // Tanımlanmış olmalı

for (const memberId of memberIds) {
    const notificationId = env.NOTIFICATION.idFromName(memberId);
    const stub = env.NOTIFICATION.get(notificationId);

    // CRITICAL: Bu fetch işlemi, loglarda görünür olmalıdır.
    await stub.fetch("http://do/presence", { // VEYA 'http://do/notify/presence' (NDO içindeki rotanıza göre)
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messagePayload)
    });
}

        // --- 3. Başarılı yanıtı döndürme ---
        return new Response(JSON.stringify({ message: "Sunucudan başarıyla ayrıldınız.", serverId }), { status: 200 });

    } catch (error) {
        console.error("Sunucudan ayrılma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}