
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

// Gerekli iznin bitmask değerini varsayıyoruz. Bu, PERMISSIONS objenizde tanımlanmalıdır.
// const CAN_CREATE_CHANNEL = PERMISSIONS.MANAGE_CHANNELS; // Örn: 256 veya 512

export async function handleCreateChannel(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId, channelName, typeId } = await request.json() as CreateChannelBody;
        const userId = payload.userId;
        const creationTimeFunc = "datetime('now')";

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

        // --- ADIM 3: BAŞARILI YANIT ---
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
        const { channelId } = await request.json() as { channelId: string };
        
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
        
        // 2. Tüm Alt Kayıtları Silme (CASCADE Delete Mantığı)
        const deleteStatements = [
            // Kanalla ilgili tüm üyelikleri sil
            env.BAYKUS_DB.prepare("DELETE FROM channel_members WHERE channel_id = ?").bind(channelId),
            
            // Kanaldaki tüm mesajların meta verisini sil (R2'deki içeriğin silinmesi ayrı bir iş mantığıdır!)
            env.BAYKUS_DB.prepare("DELETE FROM channel_messages WHERE channel_id = ?").bind(channelId),
            
            // Kanal detaylarını sil
            env.BAYKUS_DB.prepare("DELETE FROM channel_details WHERE channel_id = ?").bind(channelId),
            
            // Ana kanal kaydını sil (EN SONDA OLMALI)
            env.BAYKUS_DB.prepare("DELETE FROM channels WHERE channel_id = ?").bind(channelId)
        ];
        
        await env.BAYKUS_DB.batch(deleteStatements);
        
        return new Response(JSON.stringify({ message: "Kanal başarıyla silindi." }), { status: 200 });

    } catch (error) {
        console.error("Sunucudan ayrılma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}