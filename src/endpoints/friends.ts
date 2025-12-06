// src/endpoints/friends.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt'; 

// --- GEREKLİ INTERFACE VE SABİTLER ---


interface AddFriendBody { 
    receiverUsername: string;
 }
 
interface UpdateFriendBody {
    targetUsername: string; 
    action: 'accept' | 'reject' | 'block' | 'unfriend'; // Yeni durum eylemleri
}

// friends_status tablosundaki sabit ID'ler (Veri Bütünlüğü Kontratı)
const STATUS_IDS = {
    PENDING:    'FRIEND_PENDING',
    ACCEPTED:   'FRIEND_ACCEPTED',
    REJECTED:   'FRIEND_REJECTED',   // Reddetme ve İptal/Çıkarma (Arşivleme)
    BLOCKED:    'FRIEND_BLOCKED',
    UNFRIENDED: 'FRIEND_UNFRIENDED'
    // UNFRIENDED: 'FRIEND_UNFRIENDED' (Dört durum kısıtlamasına uyum için REJECTED kullanıldı)
};


// --- YARDIMCI FONKSİYON: KULLANICI ID'LERİNİ ÇEKME VE SIRALAMA ---
// (Veritabanındaki Composite PK'ya uygunluk için kritik)
async function getSortedUserIds(env: Env, currentUsername: string, targetUsername: string): Promise<{ user1: string, user2: string, receiverId: string } | null> {
    
    const lowerCurrentUsername = currentUsername.toLowerCase();
    const lowerTargetUsername = targetUsername.toLowerCase();

    const [currentUserResult, targetUserResult] = await Promise.all([
        env.BAYKUS_DB.prepare("SELECT user_id FROM users WHERE username = ?").bind(lowerCurrentUsername).first<{user_id: string}>(),
        env.BAYKUS_DB.prepare("SELECT user_id FROM users WHERE username = ?").bind(lowerTargetUsername).first<{user_id: string}>(),
    ]);

    const currentId = currentUserResult?.user_id;
    const targetId = targetUserResult?.user_id;

    if (!currentId || !targetId) return null;

    // Composite Primary Key için ID'leri sırala: (user1 < user2)
    const user1 = currentId < targetId ? currentId : targetId;
    const user2 = currentId > targetId ? currentId : targetId;

    return { user1, user2, receiverId: targetId };
}


// ------------------------------------------------------------------
// 1. ARKADAŞLIK İSTEĞİ GÖNDERME (/api/friends/add)
// ------------------------------------------------------------------
export async function handleAddFriend(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { receiverUsername } = (await request.json()) as AddFriendBody;
        const currentUsername = payload.username; 
        
        const ids = await getSortedUserIds(env, currentUsername, receiverUsername);
        if (!ids) {
            return new Response(JSON.stringify({ error: "Kullanıcı adı/adları geçersiz." }), { status: 404 });
        }
        const { user1, user2, receiverId } = ids;
        const now = new Date().toISOString(); 

        // 1. Mevcut durumu kontrol etme
        const checkResult = await env.BAYKUS_DB.prepare("SELECT status_id FROM friends WHERE user_id = ? AND friend_id = ?").bind(user1, user2).first('status_id');
        
        if (checkResult) {
            // Zaten bir ilişki varsa (PENDING, ACCEPTED, BLOCKED, REJECTED), tekrar gönderilemez.
            return new Response(JSON.stringify({ error: `Arkadaşlık isteği zaten ${checkResult} durumunda.` }), { status: 409 });
        }

        // 2. Arkadaşlık İsteğini Kaydetme (INSERT)
        await env.BAYKUS_DB.prepare(
            // created_at ve updated_at alanları eklendi.
            "INSERT INTO friends (user_id, friend_id, status_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(user1, user2, STATUS_IDS.PENDING, now, now).run();

        // NDO yayını (İsteğin gönderildiğini bildirir)
        const notificationPayload = {
            type: "FRIEND_STATUS_UPDATE",
            data: {
                action: "REQUEST", // ACCEPT, REJECT, BLOCK, UNFRIEND
                statusId: STATUS_IDS.PENDING,       // FRIEND_ACCEPTED, FRIEND_REJECTED, vb.
                initiatorId: payload.userId,   // İşlemi yapan kişi
                targetId: receiverId,     // Hedef kişi
                timestamp: Date.now()
            }
        };

        const notificationId = env.NOTIFICATION.idFromName("global");
        const notificationStub = env.NOTIFICATION.get(notificationId);
        
        // NDO'ya yayın (Background process)
        await notificationStub.fetch("/presence", { 
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notificationPayload),
        }).catch(e => console.error(`Arkadaş durumu bildirimi yayınlanırken hata oluştu:`, e));



        return new Response(JSON.stringify({ message: "Arkadaşlık isteği gönderildi.", receiverId }), { status: 201 });

    } catch (error) {
        console.error("Arkadaş ekleme hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}














// ------------------------------------------------------------------
// 2. ARKADAŞLIK DURUMU GÜNCELLEME (/api/friends/update) - Soft Delete/Arşivleme için
// ------------------------------------------------------------------
export async function handleUpdateFriendStatus(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { targetUsername, action } = (await request.json()) as UpdateFriendBody;
        const currentUsername = payload.username;
         const currentUserId = payload.userId; 
        
        if (!targetUsername || !['accept', 'reject', 'block', 'unfriend'].includes(action)) {
            return new Response(JSON.stringify({ error: "Geçersiz kullanıcı adı veya eylem." }), { status: 400 });
        }
    

        const ids = await getSortedUserIds(env, currentUsername, targetUsername);
        if (!ids) return new Response(JSON.stringify({ error: "Hedef kullanıcı bulunamadı." }), { status: 404 });
        const { user1, user2 } = ids;
        const now = new Date().toISOString();

        let targetStatus: string;
        let requiredStatus: string[] = []; // İşlemin yapılabilmesi için kaydın hangi durumda olması gerekir.

        // --- İŞLEM MANTIĞI VE GEÇERLİ DURUM KONTROLLERİ ---
        switch (action) {
            case 'accept':
                targetStatus = STATUS_IDS.ACCEPTED;
                requiredStatus = [STATUS_IDS.PENDING]; // Kabul sadece beklemede olanlara yapılır.
                break;
            case 'reject':
                targetStatus = STATUS_IDS.REJECTED;
                requiredStatus = [STATUS_IDS.PENDING]; // Red sadece beklemede olanlara yapılır (Arşivleme).
                break;
            case 'unfriend':
                targetStatus = STATUS_IDS.UNFRIENDED; // Arkadaşlığı sonlandırma (Arşivleme).
                requiredStatus = [STATUS_IDS.ACCEPTED]; // Unfriend sadece kabul edilmiş olana yapılır.
                break;
            case 'block':
                targetStatus = STATUS_IDS.BLOCKED;
                // Engelleme, hem PENDING hem de ACCEPTED ilişkileri üzerine yapılabilir.
                requiredStatus = [STATUS_IDS.PENDING, STATUS_IDS.ACCEPTED,STATUS_IDS.UNFRIENDED]; 
                break;
            default:
                return new Response(JSON.stringify({ error: "Geçersiz eylem." }), { status: 400 });
        }


        // Güncelleme Sorgusu (Soft Delete/Arşivleme)
        const updateQuery = env.BAYKUS_DB.prepare(`
            UPDATE friends 
            SET status_id = ?, updated_at = ? 
            WHERE user_id = ? 
              AND friend_id = ? 
              AND status_id IN (${requiredStatus.map(() => '?').join(',')})
        `);
        
        // Bind değerleri: [Yeni Status, Güncel Zaman, User1, User2, ...Required Statuses]
        const bindValues = [targetStatus, now, user1, user2, ...requiredStatus];
        
        const result = (await updateQuery.bind(...bindValues).run());
        const changes = (result as any).changes || (result as any).meta.changes || 0;

        if (changes === 0) {
            return new Response(JSON.stringify({ 
                error: `Eylem için uygun (aktif/bekleyen) ilişki bulunamadı.`,
                currentAction: action 
            }), { status: 404 });
        }

        // NDO yayını (Durum değişikliği bildirimi)
            const notificationPayload = {
            type: "FRIEND_STATUS_UPDATE",
            data: {
                // Aksiyon: accept, reject, block, unfriend (Büyük harf olarak iletilir)
                action: action.toUpperCase(), 
                // Sonuç Durumu: FRIEND_ACCEPTED, FRIEND_REJECTED, vs.
                statusId: targetStatus,       
                
                // İlişkinin her iki tarafı için de kimlik bilgileri:
                initiatorId: currentUserId,   // İşlemi yapan kişinin ID'si
                targetId: ids.receiverId,     // Hedef kişinin ID'si
                
                // İlişkinin D1'deki benzersiz anahtarları (bu, front-end'in kaydı bulmasını kolaylaştırır):
                userId1: user1,
                userId2: user2,

                timestamp: Date.now()
            }
        };

        const notificationId = env.NOTIFICATION.idFromName("global");
        const notificationStub = env.NOTIFICATION.get(notificationId);
        
        // NDO'ya yayınlama
        await notificationStub.fetch("/presence", { 
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notificationPayload),
        }).catch(e => console.error(`Arkadaş durumu bildirimi yayınlanırken hata oluştu:`, e));


        return new Response(JSON.stringify({ message: `İlişki başarıyla güncellendi: ${action}.`, status: targetStatus }), { status: 200 });

    } catch (error) {
        console.error("Durum güncelleme hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}