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
        const ownerMemberRoleId = crypto.randomUUID();
        // --- ADIM A: TEMEL KAYITLAR (Foreign Key'leri korumak için ilk olmalı) ---

// --- ADIM 3: ATOMİK BATCH İŞLEMLERİ (Veri Bütünlüğü İçin) ---
        const batchStatements = [
        // 1. SERVERS: Sunucuyu kaydetme
        env.BAYKUS_DB.prepare("INSERT INTO servers (server_id, owner_id, server_name, created_at) VALUES (?, ?, ?, ?)").bind(serverId, ownerId, serverName, creationTime),

        // 2. SERVER_MEMBERS: Owner'ı sunucu üyesi yapma
        env.BAYKUS_DB.prepare("INSERT INTO server_members (server_id, user_id, joined_at, left_at) VALUES (?, ?, ?, NULL)").bind(serverId, ownerId, creationTime), 
        
        // 3. ROLES: OWNER Rolü Tanımı
        env.BAYKUS_DB.prepare("INSERT INTO roles (role_id, server_id, role_name, permissions, is_default) VALUES (?, ?, 'Owner', ?, FALSE)").bind(ownerRoleId, serverId, 1023), 
        
        // 4. SERVER_DETAILS: Varsayılan Konfigürasyonları Ekleme (YENİ EKLENDİ)
        env.BAYKUS_DB.prepare(
            "INSERT INTO server_details (server_id, welcome_message, system_log_channel_id) VALUES (?, ?, ?)"
        ).bind(serverId, `Sunucuya hoş geldiniz! ${serverName}`, generalChannelId),

        // 5. CHANNELS: Varsayılan Kanalı Ekleme
        env.BAYKUS_DB.prepare("INSERT INTO channels (channel_id, server_id, channel_type_id, channel_name, created_at) VALUES (?, ?, ?, 'genel', ?)").bind(generalChannelId, serverId, defaultTypeTextId, creationTime),
        
        // 6. CHANNEL_DETAILS: Varsayılan Kanal Konfigürasyonunu Ekleme (YENİ EKLENDİ)
        env.BAYKUS_DB.prepare(
            "INSERT INTO channel_details (channel_id, topic, slow_mode_seconds) VALUES (?, ?, ?)"
        ).bind(generalChannelId, "Bu, Baykuş sunucusunun genel sohbet kanalıdır.", 0),
        
        // 7. MEMBER_ROLES: Owner'a Owner Rolünü Atama
        env.BAYKUS_DB.prepare(
                // 🚨 DÜZELTME: member_role_id (PK) eklendi
                "INSERT INTO member_roles (member_role_id, user_id, role_id, server_id, assigned_at, left_at) VALUES (?, ?, ?, ?, ?, NULL)"
            ).bind(ownerMemberRoleId, ownerId, ownerRoleId, serverId, creationTime),
        // 8. CHANNEL_MEMBERS: Owner'ı varsayılan kanala üye yapma
        env.BAYKUS_DB.prepare("INSERT INTO channel_members (channel_id, user_id, joined_at, left_at) VALUES (?, ?, ?, NULL)")
            .bind(generalChannelId, ownerId, creationTime)
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

    const serverStatus = await env.BAYKUS_DB.prepare(
        "SELECT deleted_at FROM servers WHERE server_id = ?"
    ).bind(serverId).first<{ deleted_at: string | null }>();

    if (!serverStatus || serverStatus.deleted_at !== null) {
        // Sunucu ya yok ya da silinmiş (arşivlenmiş).
        return new Response(JSON.stringify({ error: "Sunucu bulunamadı veya silinmiştir." }), { status: 404 });
    }


const batchStatements = [];
const isReturningMember = memberCheck && memberCheck.left_at !== null;
const isNewMember = !memberCheck; // Kayıt hiç yoktu.


// --- AKIŞ 1: ZATEN AKTİF ---
if (memberCheck && memberCheck.left_at === null) {
    // ZATEN AKTİF: İşlem yapmaya gerek yok, başarıyla dön.
    return new Response(JSON.stringify({ message: "Sunucuda zaten aktiftiniz.", serverId }), { status: 200 });
}

// --- AKIŞ 2 & 3: PASİF VEYA YENİ KATILIM (Bu durumda Batch çalışır) ---

if (isReturningMember) {
    // 1A. PASİF (Geri Dönüş): Soft Un-Delete (UPDATE)
    // Server_members kaydını tekrar aktif et.
    batchStatements.push(env.BAYKUS_DB.prepare(
        "UPDATE server_members SET left_at = NULL, joined_at = ? WHERE server_id = ? AND user_id = ?"
    ).bind(creationTime, serverId, userId)); 

    // 2A. CHANNEL_MEMBERS: Kanala yeniden ekle (eski pasif kaydı güncellemek yerine yeni aktif kayıt eklenir, bu daha temizdir)
    batchStatements.push(env.BAYKUS_DB.prepare(
        "INSERT INTO channel_members (channel_id, user_id, joined_at, left_at) VALUES (?, ?, ?, NULL)"
    ).bind(defaultChannel, userId, creationTime));

    // 3A. MEMBER_ROLES: Rolleri yeniden ata (LeaveServer'da sildiğimiz için zorunlu INSERT)
    batchStatements.push(env.BAYKUS_DB.prepare(
        "INSERT INTO member_roles (user_id, role_id, server_id) VALUES (?, ?, ?)"
    ).bind(userId, defaultRole, serverId));

} else if (isNewMember) {
    // 1B. YENİ ÜYE: Tüm kayıtları INSERT et.
    
    // a) server_members INSERT
    batchStatements.push(env.BAYKUS_DB.prepare(
        "INSERT INTO server_members (server_id, user_id, joined_at, left_at) VALUES (?, ?, ?, NULL)"
    ).bind(serverId, userId, creationTime));
    
    // b) MEMBER_ROLES INSERT
    batchStatements.push(env.BAYKUS_DB.prepare(
        "INSERT INTO member_roles (user_id, role_id, server_id) VALUES (?, ?, ?)"
    ).bind(userId, defaultRole, serverId));
    
    // c) CHANNEL_MEMBERS INSERT
    batchStatements.push(env.BAYKUS_DB.prepare(
        "INSERT INTO channel_members (channel_id, user_id, joined_at, left_at) VALUES (?, ?, ?, NULL)"
    ).bind(defaultChannel, userId, creationTime));
}

// --- BATCH ÇALIŞTIRMA VE NDO YAYINI ---
if (batchStatements.length > 0) {
    await env.BAYKUS_DB.batch(batchStatements);

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
    }


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
            ).bind(userId, serverId),
        ];

        
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






// src/endpoints/rooms.ts (handleDeleteServer - SOFT DELETE İLE GÜNCELLENDİ)

export async function handleDeleteServer(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId } = await request.json() as { serverId: string };
        const userId = payload.userId;
        const deletionTime = new Date().toISOString();
        
        if (!serverId) {
            return new Response(JSON.stringify({ error: "Sunucu ID'si gerekli." }), { status: 400 });
        }

        // --- ADIM 1: YETKİ KONTROLÜ (Owner Kontrolü) ---
        const serverOwner = await env.BAYKUS_DB.prepare(
            "SELECT owner_id, deleted_at FROM servers WHERE server_id = ?"
        ).bind(serverId).first<{ owner_id: string, deleted_at: string | null }>();

        // Sunucu hiç yoksa veya zaten silinmişse 404 dön.
        if (!serverOwner || serverOwner.deleted_at !== null) {
            return new Response(JSON.stringify({ error: "Sunucu bulunamadı veya daha önce silinmiş." }), { status: 404 });
        }

        // Kullanıcı Owner değilse (veya Admin değilse)
        if (serverOwner.owner_id !== userId) {
            return new Response(JSON.stringify({ error: "Sunucuyu silme yetkiniz yok. Sadece kurucu silebilir." }), { status: 403 });
        }

        // --- ADIM 2: SOFT DELETE (Sunucuyu pasif hale getir) ---
        // SADECE servers tablosu güncellenir. Alt tablolar (channel_members, roles, R2) korunur.
        const updateStatement = env.BAYKUS_DB.prepare(
            "UPDATE servers SET deleted_at = ? WHERE server_id = ?"
        ).bind(deletionTime, serverId);

        await updateStatement.run(); // Tek bir UPDATE işlemi

        
        // --- ADIM 3: NDO BİLDİRİMİ (Sunucunun pasifleştiğini herkese duyur) ---
        // (NDO yayını kodunuzu buraya eklemeyi unutmayın)

        
        // --- ADIM 4: BAŞARILI YANIT ---
        return new Response(JSON.stringify({ message: "Sunucu başarıyla silindi ve arşivlendi. Veriler log amaçlı saklanmaya devam edecektir." }), { status: 200 });

    } catch (error) {
        console.error("Sunucu silme hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu silme işlemi başarısız oldu." }), { status: 500 });
    }
}