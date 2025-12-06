// src/endpoints/rooms.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt'; 
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
        const creationTime = new Date().toISOString();

       // --- ADIM 1: GEREKLİ LOOKUP ID'LERİNİ ÇEKME ---
        // (Bu sorgular, lookup tablolarının dolu olduğunu varsayar)
        const typeTextResult = await env.BAYKUS_DB.prepare(
            "SELECT channel_type_id FROM channels_types WHERE channel_type_name = 'Yazılı Kanal'"
        ).first('channel_type_id');
        
        if (!typeTextResult) {
             return new Response(JSON.stringify({ error: "Sistem, Yazılı Kanal tipini bulamıyor." }), { status: 500 });
        }
        const defaultTypeTextId = typeTextResult;


        // --- ADIM 2: ROL VE KANAL KAYITLARI İÇİN UUID'LERİ OLUŞTURMA ---
        const ownerRoleId = crypto.randomUUID();
        const memberRoleId = crypto.randomUUID();
        const generalChannelId = crypto.randomUUID();
        // --- ADIM A: TEMEL KAYITLAR (Foreign Key'leri korumak için ilk olmalı) ---

// --- ADIM 3: ATOMİK BATCH İŞLEMLERİ (Veri Bütünlüğü İçin) ---
        const batchStatements = [
            // 1. SERVERS: Sunucuyu kaydetme
            env.BAYKUS_DB.prepare(
                "INSERT INTO servers (server_id, owner_id, server_name, created_at) VALUES (?, ?, ?, ?)"
            ).bind(serverId, ownerId, serverName, creationTime),

            // 2. SERVER_MEMBERS: Owner'ı sunucu üyesi yapma (server_members COMPOSITE PK)
            env.BAYKUS_DB.prepare(
                "INSERT INTO server_members (server_id, user_id, joined_at, left_at) VALUES (?, ?, ?, NULL)"
            ).bind(serverId, ownerId, creationTime), 
            
            // 3. OWNER Rolü Tanımı (roles)
            env.BAYKUS_DB.prepare(
                "INSERT INTO roles (role_id, server_id, role_name, permissions, is_default) VALUES (?, ?, 'Owner', ?, FALSE)"
            ).bind(ownerRoleId, serverId, 1023), // 1023: ADMIN İzinleri
            
            // 4. MEMBER Rolü Tanımı (roles)
            env.BAYKUS_DB.prepare(
                "INSERT INTO roles (role_id, server_id, role_name, permissions, is_default) VALUES (?, ?, 'Member', ?, TRUE)"
            ).bind(memberRoleId, serverId, 64), // 64: Temel İletişim İzinleri
            
            // 5. MEMBER_ROLES: Owner'a Owner Rolünü Atama
            env.BAYKUS_DB.prepare(
                "INSERT INTO member_roles (user_id, role_id, server_id) VALUES (?, ?, ?)"
            ).bind(ownerId, ownerRoleId, serverId),

            // 6. CHANNELS: Varsayılan Kanalı Ekleme
            env.BAYKUS_DB.prepare(
                "INSERT INTO channels (channel_id, server_id, channel_type_id, channel_name, created_at) VALUES (?, ?, ?, 'genel', ?)"
            ).bind(generalChannelId, serverId, defaultTypeTextId, creationTime),
            
            // 7. CHANNEL_MEMBERS: Owner'ı varsayılan kanala üye yapma (channel_members COMPOSITE PK)
            env.BAYKUS_DB.prepare(
                "INSERT INTO channel_members (channel_id, user_id, joined_at, left_at) VALUES (?, ?, ?, NULL)"
            ).bind(generalChannelId, ownerId, creationTime)
        ];
        
        // 7. Tüm toplu INSERT işlemlerini çalıştırma
        await env.BAYKUS_DB.batch(batchStatements);

        // ... (Başarılı dönüş kodu) ...
        return new Response(JSON.stringify({ 
            message: "Sunucu oluşturuldu.", 
            serverId: serverId,
            defaultChannelId: generalChannelId,
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
        const creationTime = new Date().toISOString();
        
        if (!serverId) {
            return new Response(JSON.stringify({ error: "Sunucu ID'si gerekli." }), { status: 400 });
        }


        const userResult = await env.BAYKUS_DB.prepare(
            "SELECT username FROM users WHERE user_id = ?"
        ).bind(userId).first<{ username: string }>();

        if (!userResult) {
            return new Response(JSON.stringify({ error: "Kullanıcı bulunamadı." }), { status: 404 });
        }
        const username = userResult.username; // Artık 'username' tanımlı.

    // 1. PASİF VEYA AKTİF kaydı kontrol et (left_at değerini çekmek önemli)
    const memberCheck = await env.BAYKUS_DB.prepare(
        "SELECT left_at FROM server_members WHERE server_id = ? AND user_id = ?"
    ).bind(serverId, userId).first<{ left_at: string | null }>();


    if (memberCheck) {
        if (memberCheck.left_at === null) {
            // ZATEN AKTİF: İşlem yapmaya gerek yok, başarıyla dön.
            return new Response(JSON.stringify({ message: "Sunucuda zaten aktiftiniz.", serverId }), { status: 200 });
        }
            

        // Rol ve Kanal atamaları için gerekli bilgileri al
        const defaultRole = await env.BAYKUS_DB.prepare(
            "SELECT role_id FROM roles WHERE server_id = ? AND is_default = TRUE"
        ).bind(serverId).first('role_id');
        
        const defaultChannel = await env.BAYKUS_DB.prepare(
            "SELECT channel_id FROM channels WHERE server_id = ? AND channel_name = 'genel'"
        ).bind(serverId).first('channel_id');
        
        if (!defaultRole || !defaultChannel) {
             return new Response(JSON.stringify({ error: "Sunucu varsayılan rollerini/kanallarını bulamıyor." }), { status: 500 });
        }


        const batchStatements = [];

        if (memberCheck) {
            // Kayıt VARDI (pasif). UPDATE ile AKTİF hale getir (left_at = NULL).
            // NOT: PK değişmediği için sadece left_at ve joined_at güncellenir.
            batchStatements.push(env.BAYKUS_DB.prepare(
                "UPDATE server_members SET left_at = NULL, joined_at = ? WHERE server_id = ? AND user_id = ?"
            ).bind(creationTime, serverId, userId)); 
            
        } else {
            // Kayıt HİÇ YOKTU. YENİ KAYIT EKLE (İlk katılım)
            // server_members (server_id, user_id) COMPOSITE PK kullandığı için id'ye ihtiyacı yok.
            batchStatements.push(env.BAYKUS_DB.prepare(
                "INSERT INTO server_members (server_id, user_id, joined_at, left_at) VALUES (?, ?, ?, NULL)"
            ).bind(serverId, userId, creationTime));
            
        // 2. YENİ ROL ATAMASI (Member Rolü)
            batchStatements.push(env.BAYKUS_DB.prepare(
                "INSERT INTO member_roles (user_id, role_id, server_id) VALUES (?, ?, ?)"
            ).bind(userId, defaultRole, serverId));
        }

        // 3. YENİ KANAL ÜYELİĞİ ATAMASI (Genel Kanal)
        // Bu, kullanıcının kanala ilk kez katıldığından emin olmak için bir INSERT OR IGNORE gibi davranır.
        batchStatements.push(env.BAYKUS_DB.prepare(
            "INSERT INTO channel_members (channel_id, user_id, joined_at, left_at) VALUES (?, ?, ?, NULL)"
        ).bind(defaultChannel, userId, creationTime));
        

        // 4. BATCH İŞLEMİNİ ÇALIŞTIRMA
        await env.BAYKUS_DB.batch(batchStatements);
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
        if (!serverId) {
            return new Response(JSON.stringify({ error: "Sunucu ID'si gerekli." }), { status: 400 });
        }
        const leaveTime = new Date().toISOString();

        // --- ADIM 0: Güvenilir Kullanıcı Adını D1'den Çekme (NDO yayını için) ---
        // 'payload.username' yerine D1'den çekiyoruz, böylece NDO mesajı güvenilir olur.
        const userResult = await env.BAYKUS_DB.prepare(
            "SELECT username FROM users WHERE user_id = ?"
        ).bind(userId).first<{ username: string }>();

        if (!userResult) {
            return new Response(JSON.stringify({ error: "Kullanıcı bulunamadı." }), { status: 404 });
        }
        const username = userResult.username;

// --- ADIM 1: SOFT DELETE İŞLEMLERİ (ATOMİK BATCH) ---
        const batchStatements = [
            // 1. SERVER_MEMBERS: Ana üyeliği pasifleştir (left_at'i ayarla)
            env.BAYKUS_DB.prepare(
                "UPDATE server_members SET left_at = ? WHERE server_id = ? AND user_id = ? AND left_at IS NULL"
            ).bind(leaveTime, serverId, userId), 

            // 2. CHANNEL_MEMBERS: Kullanıcının bu sunucudaki tüm kanallardan çıkmasını kaydet (Çok önemli!)
            // Sunucunun tüm kanallarını bulup, o kanallardaki üyeliği güncellemek gerekir.
            // EN VERİMLİ YOL: Bu sunucudaki tüm aktif kanal üyeliklerini güncelle.
            env.BAYKUS_DB.prepare(`
                UPDATE channel_members
                SET left_at = ?
                WHERE user_id = ? AND left_at IS NULL
                  AND channel_id IN (SELECT channel_id FROM channels WHERE server_id = ?)
            `).bind(leaveTime, userId, serverId),
            
            // 3. MEMBER_ROLES: Kullanıcının bu sunucudaki tüm rollerini sil (Rol atamalarını temizle)
            // Kullanıcı ayrıldığı anda rolleri taşımamalıdır.
            env.BAYKUS_DB.prepare(
                "DELETE FROM member_roles WHERE user_id = ? AND server_id = ?"
            ).bind(userId, serverId)
        ];

        // 3. MEMBER_ROLES: Kullanıcının bu sunucudaki tüm rollerini sil (Rol atamalarını temizle)
            // Kullanıcı ayrıldığı anda rolleri taşımamalıdır.
            env.BAYKUS_DB.prepare(
                "DELETE FROM roles WHERE user_id = ? AND server_id = ?"
            ).bind(userId, serverId)
        
        // Tüm işlemleri atomik olarak çalıştır
        await env.BAYKUS_DB.batch(batchStatements);      
        
        
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

