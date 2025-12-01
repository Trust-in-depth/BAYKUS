// src/endpoints/rooms.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt'; 
import { PERMISSIONS } from '../auth/permissions';
// Gelen JSON gövdesinin yapısını tanımlıyoruz
interface CreateServerBody {
    serverName: string;
}

// src/endpoints/rooms.ts (handleCreateServer)

export async function handleCreateServer(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverName } = await request.json() as CreateServerBody;
        if (!serverName) {
            return new Response(JSON.stringify({ error: "Sunucu adı gerekli." }), { status: 400 });
        }
        
        // DÜZELTME 1: ID'ler için temiz UUID kullanın (Çakışmayı önlemek için)
        const serverId = crypto.randomUUID(); 
        const ownerId = payload.userId;

        // --- ADIM A: TEMEL KAYITLAR (Foreign Key'leri korumak için ilk olmalı) ---

        // 1. D1'e Sunucuyu Kaydetme (servers tablosu) - BU İLK OLMALIDIR
        await env.BAYKUS_DB.prepare(
            "INSERT INTO servers (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)"
        ).bind(serverId, serverName, ownerId, new Date().toISOString()).run();

        // 2. Varsayılan Kanal Ekleme (channels tablosu)
        // Kanal ID'sine uygun ön eki ekle
        const defaultChannelId = 'CHANNEL-' + crypto.randomUUID();
        await env.BAYKUS_DB.prepare(
            "INSERT INTO channels (id, server_id, name, type, topic, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(defaultChannelId, serverId, 'genel-sohbet', 'text', 'Sohbetin başladığı yer.', new Date().toISOString()).run();


        // --- ADIM B: ROL VE ÜYELİK ATAMALARI (servers tablosuna bağlı) ---
        
        const ownerRoleId = crypto.randomUUID();
        const memberRoleId = crypto.randomUUID();

        const batchStatements = [
            // 3. OWNER Rolü Tanımı (roles tablosu)
            env.BAYKUS_DB.prepare(
                "INSERT INTO roles (id, server_id, name, permissions, is_default) VALUES (?, ?, 'Owner', ?, FALSE)"
            ).bind(ownerRoleId, serverId, PERMISSIONS.ADMINISTRATOR),
            
            // 4. MEMBER Rolü Tanımı (roles tablosu)
            env.BAYKUS_DB.prepare(
                "INSERT INTO roles (id, server_id, name, permissions, is_default) VALUES (?, ?, 'Member', ?, TRUE)"
            ).bind(memberRoleId, serverId, PERMISSIONS.SEND_MESSAGES), 
            
            // 5. Owner'ı sunucuya üye yap (server_members tablosu) - ROLE SÜTUNU KALDIRILDI
            env.BAYKUS_DB.prepare(
                "INSERT INTO server_members (id, server_id, user_id, joined_at) VALUES (?, ?, ?, ?)"
            ).bind(crypto.randomUUID(), serverId, ownerId, new Date().toISOString()),
            
            // 6. Owner'a Owner Rolünü Atama (member_roles tablosu)
            env.BAYKUS_DB.prepare(
                "INSERT INTO member_roles (user_id, role_id, server_id) VALUES (?, ?, ?)"
            ).bind(ownerId, ownerRoleId, serverId)
        ];
        
        // 7. Tüm toplu INSERT işlemlerini çalıştırma
        await env.BAYKUS_DB.batch(batchStatements);

        // ... (Başarılı dönüş kodu) ...
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
                "INSERT INTO server_members (id, server_id, user_id, joined_at, left_at) VALUES (?, ?, ?, ?, NULL)"
            ).bind(crypto.randomUUID(), serverId, userId, new Date().toISOString()).run(); 
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

// src/endpoints/rooms.ts (handleLeaveServer fonksiyonu - UX ODAKLI DÜZELTME)

export async function handleLeaveServer(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId } = await request.json() as { serverId: string };
        const userId = payload.userId;
        const username = payload.username || 'Bilinmeyen Kullanıcı';
        
        if (!serverId) {
            return new Response(JSON.stringify({ error: "Sunucu ID'si gerekli." }), { status: 400 });
        }

        // --- 1. D1'de üyeliği Soft Delete yapma ---
        // Bu sorgu, kaydı bulursa left_at'i günceller. Bulamazsa 0 değişiklik yapar (başarısız sayılmaz).
        const updateQuery = env.BAYKUS_DB.prepare(
            "UPDATE server_members SET left_at = strftime('%s','now') WHERE server_id = ? AND user_id = ? AND left_at IS NULL"
        );
        
        // Sorguyu çalıştırıyoruz; changes değerini KONTROL ETMİYORUZ.
        await updateQuery.bind(serverId, userId).run(); 
        
        // --- 2. NDO BİLDİRİMİ GÖNDER (LEAVE) ---
        // Kayıt güncellense de güncellenmese de NDO yayını yapılır (UX için).
        const messagePayload = {
            type: "PRESENCE_UPDATE",
            data: { action: "LEAVE", userId: userId, username: username, serverId: serverId, timestamp: Date.now() }
        };

        const notificationId = env.NOTIFICATION.idFromName("global");
        const notificationStub = env.NOTIFICATION.get(notificationId);
        const doUrl = new URL("http://do/presence");
        
        // Asenkron yayınlama
        await notificationStub.fetch(doUrl.toString(), {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messagePayload),
        }).catch(e => console.error(`Ayrılma bildirimi yayınlanırken hata oluştu:`, e));
        
        
        // 3. BAŞARILI YANIT (Her durumda 200 OK)
        // Kullanıcının ayrıldığına dair kesin onay verilir.
        return new Response(JSON.stringify({ message: "Sunucudan başarıyla ayrıldınız.", serverId }), { status: 200 });

    } catch (error) {
        console.error("Sunucudan ayrılma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}