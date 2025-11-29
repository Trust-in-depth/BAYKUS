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



export async function handleJoinServer(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId } = await request.json() as { serverId: string };
        const userId = payload.userId;
        const username = payload.username || 'Bilinmeyen Kullanıcı'; 
        
        if (!serverId) {
            return new Response(JSON.stringify({ error: "Sunucu ID'si gerekli." }), { status: 400 });
        }

        // 1. PASİF kaydı kontrol et ve AKTİF HALE GETİR (Soft Un-Delete)
        const previousMember = await env.BAYKUS_DB.prepare(
            "SELECT id FROM server_members WHERE server_id = ? AND user_id = ?"
        ).bind(serverId, userId).first('id');


        if (previousMember) {
            // Kayıt VARDI (pasif). UPDATE ile AKTİF hale getir (left_at = NULL).
            await env.BAYKUS_DB.prepare(
                "UPDATE server_members SET left_at = NULL, joined_at = strftime('%s','now') WHERE id = ?"
            ).bind(previousMember).run(); 
            
        } else {
            // Kayıt HİÇ YOKTU. YENİ KAYIT EKLE (İlk katılım)
            await env.BAYKUS_DB.prepare(
                "INSERT INTO server_members (id, server_id, user_id, role, joined_at, left_at) VALUES (?, ?, ?, ?, strftime('%s','now'), NULL)"
            ).bind(crypto.randomUUID(), serverId, userId, 'member').run(); 
        }

        
        // 2. NDO BİLDİRİMİ GÖNDER (JOIN)
        const messagePayload = {
            type: "PRESENCE_UPDATE",
            data: {
                action: "JOIN",
                userId: userId,
                username: username,
                serverId: serverId,
                timestamp: Date.now()
            }
        };

        const notificationId = env.NOTIFICATION.idFromName("global"); 
        const notificationStub = env.NOTIFICATION.get(notificationId);
        const doUrl = new URL("http://do/presence"); 
        
        await notificationStub.fetch(doUrl.toString(), {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messagePayload),
        }).catch(e => console.error(`Katılım bildirimi yayınlanırken hata oluştu:`, e));
        
        
        // 3. BAŞARILI YANIT
        return new Response(JSON.stringify({ message: "Sunucuya başarıyla katıldınız.", serverId }), { status: 200 });

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
// 1. ADIM: AKTİF KAYIT KONTROLÜ (SELECT)
const activeMembership = await env.BAYKUS_DB.prepare(
    // Aktif kaydı (left_at IS NULL) bul ve ID'sini çek
    "SELECT id FROM server_members WHERE server_id = ? AND user_id = ? AND left_at IS NULL" 
).bind(serverId, userId).first('id');

if (!activeMembership) {
    // Eğer aktif kayıt yoksa, UPDATE yapmaya gerek kalmaz.
    return new Response(JSON.stringify({ error: "Bu sunucuda aktif üyelik bulunamadı." }), { status: 404 });
}

// 2. ADIM: KAYDI ID İLE GÜNCELLE (UPDATE)
// Sadece bulunan ID'yi güncelleyerek hata riskini azaltırız.
const updateQuery = env.BAYKUS_DB.prepare(
    // Sorguyu sadece ID'ye odaklıyoruz
    "UPDATE server_members SET left_at = strftime('%s','now') WHERE id = ?"
);
const result = await updateQuery.bind(activeMembership).run(); 
// ^^^ Bu sorgunun changes değeri artık büyük ihtimalle 1 dönecektir.
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