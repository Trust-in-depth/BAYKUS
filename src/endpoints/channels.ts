
import { Env } from '../types';
import { AuthPayload } from '../auth/jwt'; 
import { PERMISSIONS } from '../auth/permissions';
// Gelen JSON gövdesinin yapısını tanımlıyoruz
interface CreateChannelBody {
    serverId: string;
    channelName: string;
    typeId: string;
}
interface UpdateChannelBody {
    channelId: string;
    newTopic?: string;
    newName?: string;
    newType?: string;
}

interface DeleteChannelBody {
    channelId: string;
}

// Gerekli iznin bitmask değerini varsayıyoruz. Bu, PERMISSIONS objenizde tanımlanmalıdır.
// const CAN_CREATE_CHANNEL = PERMISSIONS.MANAGE_CHANNELS; // Örn: 256 veya 512

export async function handleCreateChannel(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId, channelName, typeId } = await request.json() as CreateChannelBody;
        const userId = payload.userId;
        const creationTimeFunc = new Date().toISOString();

        if (!serverId || !channelName || !typeId) {
            return new Response(JSON.stringify({ error: "Sunucu/Kanal adı veya tip bilgisi eksik." }), { status: 400 });
        }

        // --- ADIM 1: YETKİ KONTROLÜ (KRİTİK) ---
        // Kullanıcının, bu sunucuda kanal oluşturma izni olup olmadığını kontrol etme.
        // Bu sorgu, kullanıcının rollerini birleştirir ve toplu izin değerini alır.
        const userPermissions = await env.BAYKUS_DB.prepare(`
            SELECT SUM(T2.permissions) AS total_permissions
            FROM member_roles AS T1
            JOIN roles AS T2 ON T1.role_id = T2.role_id
            WHERE T1.user_id = ? AND T1.server_id = ?
        `).bind(userId, serverId).first<{ total_permissions: number }>();
        
        const totalPermissions = userPermissions?.total_permissions || 0;
        
        // Eğer kullanıcının toplam izin değeri, kanal oluşturma iznini (örneğin 256) içermiyorsa, reddet.
        // Not: PERMISSIONS objenizin bitmask değerleri burada kullanılmalıdır.
        if ((totalPermissions & PERMISSIONS.MANAGE_CHANNELS) === 0) { 
            return new Response(JSON.stringify({ error: "Bu sunucuda kanal oluşturma yetkiniz yok." }), { status: 403 });
        }


        // --- ADIM 2: KANAL OLUŞTURMA (Geçerli Kullanıcı) ---
        const newChannelId = crypto.randomUUID();

        const batchStatements = [
            // 1. CHANNELS: Yeni Kanalı Ekleme
            env.BAYKUS_DB.prepare(
                "INSERT INTO channels (channel_id, server_id, channel_type_id, channel_name, created_at) VALUES (?, ?, ?, ?, ?)"
            ).bind(newChannelId, serverId, typeId, channelName, creationTimeFunc),
            
            // 2. CHANNEL_MEMBERS: Oluşturanı kanala üye yapma
            env.BAYKUS_DB.prepare(
                "INSERT INTO channel_members (channel_id, user_id, joined_at, left_at) VALUES (?, ?, ?, NULL)"
            ).bind(newChannelId, userId, creationTimeFunc)
        ];

        await env.BAYKUS_DB.batch(batchStatements);


// --- ADIM 3: NDO BİLDİRİMİ (Kanalın Oluşturulduğunu Yayınlama) ---
        // Sunucudaki tüm aktif kullanıcılara anlık bildirim gönderilir.
        const messagePayload = {
            type: "CHANNEL_UPDATE",
            data: { 
                action: "CREATED", 
                serverId: serverId,
                channelId: newChannelId,
                channelName: channelName, // Kanal adını front-end'in kolaylığı için ekliyoruz
                typeId: typeId,
                creatorId: userId,
                timestamp: Date.now()
            }
        };

        const notificationId = env.NOTIFICATION.idFromName("global");
        const notificationStub = env.NOTIFICATION.get(notificationId);
        const doUrl = new URL("http://do/presence");
        
        // Asenkron yayınlama
        await notificationStub.fetch(doUrl.toString(), {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messagePayload),
        }).catch(e => console.error(`Kanal oluşturma bildirimi yayınlanırken hata oluştu:`, e));


        // --- ADIM 4: BAŞARILI YANIT ---
        return new Response(JSON.stringify({ 
            message: "Kanal başarıyla oluşturuldu.", 
            channelId: newChannelId,
        }), { status: 201 });

    } catch (error) {
        console.error("Kanal oluşturma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}









export async function handleUpdateChannel(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { channelId, newTopic, newName, newType } = await request.json() as UpdateChannelBody;
        const userId = payload.userId;
        
        // 1. Yetki Kontrolü (İzin Sorgusu aynı CreateChannel'daki gibidir)
        const userPermissions = await env.BAYKUS_DB.prepare(`
            SELECT SUM(T2.permissions) AS total_permissions
            FROM member_roles AS T1
            JOIN roles AS T2 ON T1.role_id = T2.role_id
            WHERE T1.user_id = ? AND T1.server_id = (SELECT server_id FROM channels WHERE channel_id = ?)
        `).bind(userId, channelId).first<{ total_permissions: number }>();
        
        const totalPermissions = userPermissions?.total_permissions || 0;
        
        // MANAGE_CHANNELS izni olmayanlar reddedilir.
        if ((totalPermissions & PERMISSIONS.MANAGE_CHANNELS) === 0) { 
            return new Response(JSON.stringify({ error: "Kanal ayarlarını düzenleme yetkiniz yok." }), { status: 403 });
        }


        // 2. Güncelleme sorgusunu oluştur (Yalnızca sağlanan alanları güncelle)
        const updateStatements = [];

        // channels tablosu güncellemeleri
        if (newName) {
            updateStatements.push(env.BAYKUS_DB.prepare(
                "UPDATE channels SET channel_name = ? WHERE channel_id = ?"
            ).bind(newName, channelId));
        }
        if (newType) { // Yeni Kanal Tipi (channel_type_id)
            updateStatements.push(env.BAYKUS_DB.prepare(
                "UPDATE channels SET channel_type_id = ? WHERE channel_id = ?"
            ).bind(newType, channelId));
        }

        // channel_details tablosu güncellemeleri
        if (newTopic) {
            updateStatements.push(env.BAYKUS_DB.prepare(
                "UPDATE channel_details SET topic = ? WHERE channel_id = ?"
            ).bind(newTopic, channelId));
        }
        
        // 3. Batch olarak çalıştırma
        if (updateStatements.length > 0) {
            await env.BAYKUS_DB.batch(updateStatements);
            return new Response(JSON.stringify({ message: "Kanal güncellendi." }), { status: 200 });
        }
        
        return new Response(JSON.stringify({ error: "Güncellenecek alan yok." }), { status: 400 });

    } catch (error) {
        console.error("Kanal güncelleme hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}








export async function handleDeleteChannel(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { channelId } = await request.json() as DeleteChannelBody;
        const deletionTime = new Date().toISOString();

        // 1. KRİTİK YETKİ KONTROLÜ (ADMINISTRATOR veya DELETE_CHANNEL izni)
     // handleCreateChannel'dan kopyalanan yetki kontrolü
const userPermissions = await env.BAYKUS_DB.prepare(`
    SELECT SUM(T2.permissions) AS total_permissions
    FROM member_roles AS T1
    JOIN roles AS T2 ON T1.role_id = T2.role_id
    WHERE T1.user_id = ? AND T1.server_id = (SELECT server_id FROM channels WHERE channel_id = ?)
`).bind(payload.userId, channelId).first<{ total_permissions: number }>();

const totalPermissions = userPermissions?.total_permissions || 0;

// MANAGE_CHANNELS izni olmayanlar reddedilir. (Kanal yönetimi, silmeyi de kapsar)
if ((totalPermissions & PERMISSIONS.MANAGE_CHANNELS) === 0) { 
    return new Response(JSON.stringify({ error: "Kanal silme yetkiniz yok." }), { status: 403 });
}

// --- ADIM 2: SOFT DELETE (ARŞİVLEME) MANTIĞI ---
        const batchStatements = [
            // 1. CHANNELS: Ana kanal kaydını pasifleştir (HARD DELETE yerine UPDATE)
            env.BAYKUS_DB.prepare(
                "UPDATE channels SET deleted_at = ? WHERE channel_id = ?"
            ).bind(deletionTime, channelId),
            
            // 2. CHANNEL_MEMBERS: Kanaldaki tüm aktif üyelikleri pasifleştir (Soft Delete)
            env.BAYKUS_DB.prepare(
                "UPDATE channel_members SET left_at = ? WHERE channel_id = ? AND left_at IS NULL"
            ).bind(deletionTime, channelId),
            
            // 3. CHANNEL_MESSAGES: Mesajları pasifleştir/silindi olarak işaretle (Soft Delete)
            env.BAYKUS_DB.prepare(
                "UPDATE channel_messages SET is_deleted = TRUE WHERE channel_id = ?"
            ).bind(channelId),
            
            // 4. CHANNEL_DETAILS: Kanal detaylarını pasifleştir (Eğer channels tablosu deleted_at'i kontrol etmiyorsa)
            // NOT: channel_details tablosunda deleted_at sütunu olmadığını varsayıyoruz. 
            // Bu yüzden bu tabloya dokunmuyoruz. Ana kontrol channels tablosu üzerinden yapılacaktır.
        ];
        
        await env.BAYKUS_DB.batch(batchStatements);
        
        // 5. NDO BİLDİRİMİ (Kanalın silindiğini yayınla)
const channelUpdatePayload = {
    type: "CHANNEL_UPDATE",
    data: { 
        action: "ARCHIVED", // Soft Delete yapıldığı için DELETED yerine ARCHIVED kullanmak daha doğru
        channelId: channelId,
        message: "Kanal kurucu tarafından arşivlendi."
    }
};

const notificationId = env.NOTIFICATION.idFromName("global");
const notificationStub = env.NOTIFICATION.get(notificationId);
const doUrl = new URL("http://do/presence"); // NDO'nun POST rotası

// Asenkron yayınlama
await notificationStub.fetch(doUrl.toString(), {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(channelUpdatePayload),
}).catch(e => console.error(`Kanal silme bildirimi yayınlanırken hata oluştu:`, e));
        return new Response(JSON.stringify({ message: "Kanal başarıyla silindi." }), { status: 200 });

    } catch (error) {
        console.error("Sunucudan ayrılma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}