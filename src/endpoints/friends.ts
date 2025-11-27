// src/endpoints/friends.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt'; 

// Beklenen JSON yapıları
interface AddFriendBody {
    receiverUsername: string;
}
interface UpdateFriendBody {
    targetUserId: string;
    newStatus: 'accepted' | 'rejected' | 'blocked'; 
}

// Bu interface, Worker ortamında 'D1RunResult' olarak kabul edilen yapıyı temsil eder.
interface D1WriteResult {
    success: boolean;
    error?: string;
    // D1'in etkilenen satır sayısını döndürdüğü alan
    changes: number; 
    // Bazı Workers ortamlarında 'meta' objesi altında gelir.
    meta?: { changes: number }; 
}

// D1 friends tablosundaki geçerli durumlar
const VALID_ACTIONS = ['accepted', 'rejected', 'blocked']; 

// --- 1. ARKADAŞLIK İSTEĞİ GÖNDERME (/api/friends/add) ---
export async function handleAddFriend(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
   
    // GÜVENLİK KONTROLÜ
    if (!payload || !payload.userId) {
         // Eğer JWT doğrulandıysa ama payload boşsa, Middleware doğru çalışmıyor demektir.
         console.error("JWT PAYLOAD'I BOŞ GELDİ.");
         return new Response(JSON.stringify({ error: "Oturum verisi eksik." }), { status: 403 });
    }
    
    // Eğer buraya gelindiyse, payload.userId güvenli bir şekilde kullanılabilir.
    const senderId = payload.userId;
   
    // ... (Mantık 1: Kullanıcı bulma ve 'pending' kaydı) ...
    try {
        const { receiverUsername } = (await request.json()) as AddFriendBody;
        
        // ... (Kullanıcı doğrulama ve ID bulma mantığı) ...
        const senderId = payload.userId;
        const receiverResult = await env.BAYKUS_DB.prepare("SELECT id FROM users WHERE username = ?").bind(receiverUsername).first('id');
        if (!receiverResult) {
            return new Response(JSON.stringify({ error: "Kullanıcı bulunamadı." }), { status: 404 });
        }
        const receiverId = receiverResult as string;

        // ID'leri sıralama (UNIQUE kısıtlaması için user1 < user2)
        const user1 = senderId < receiverId ? senderId : receiverId;
        const user2 = senderId > receiverId ? senderId : receiverId;
        
        // Mevcut durumu kontrol etme
        const checkResult = await env.BAYKUS_DB.prepare("SELECT status FROM friends WHERE user_id = ? AND friend_id = ?").bind(user1, user2).first('status');
        if (checkResult) {
            return new Response(JSON.stringify({ error: `Arkadaşlık isteği zaten ${checkResult} durumunda.` }), { status: 409 });
        }

        // Arkadaşlık İsteğini Kaydetme
        await env.BAYKUS_DB.prepare(
            "INSERT INTO friends (id, user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(crypto.randomUUID(), user1, user2, 'pending', new Date().toISOString()).run();

        return new Response(JSON.stringify({ message: "Arkadaşlık isteği gönderildi.", receiverId: receiverId }), { status: 201 });

    } catch (error) {
        console.error("Arkadaş ekleme hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}


// --- 2. ARKADAŞLIK DURUMU GÜNCELLEME (/api/friends/update) ---
export async function handleUpdateFriendStatus(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { targetUserId, newStatus } = (await request.json()) as UpdateFriendBody;
        const currentUserId = payload.userId;
        
        if (!targetUserId || !VALID_ACTIONS.includes(newStatus)) {
            return new Response(JSON.stringify({ error: "Geçersiz kullanıcı ID'si veya eylem." }), { status: 400 });
        }

        const user1 = currentUserId < targetUserId ? currentUserId : targetUserId;
        const user2 = currentUserId > targetUserId ? currentUserId : targetUserId;
        
        if (newStatus === 'rejected') {
            // REDDETME EYLEMİ: Kaydı D1'den sil (status kısıtlamasını ihlal etmemek için)
            const deleteQuery = env.BAYKUS_DB.prepare(
                 `DELETE FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'`
            );
            const result = await deleteQuery.bind(user1, user2).run() ;
            // Düzeltme: Sonucu D1'in tipinden 'changes' alanını güvenli şekilde çekeriz.

            const changes = (result as any).changes || (result as any).meta.changes || 0;

            if (changes === 0) {
                 return new Response(JSON.stringify({ error: "Reddedilecek bekleyen istek bulunamadı." }), { status: 404 });
            }
            
            return new Response(JSON.stringify({ message: "İstek başarıyla reddedildi.", status: 'rejected' }), { status: 200 });
       }
         
         
         else if (newStatus === 'accepted') {
            // KABUL ETME EYLEMİ: Durumu 'pending'ten 'accepted'e çevir.
            const updateQuery = env.BAYKUS_DB.prepare(
                `UPDATE friends SET status = ?, updated_at = ? WHERE user_id = ? AND friend_id = ? AND status = 'pending'`
            );
            const result = (await updateQuery.bind(newStatus, new Date().toISOString(), user1, user2).run()) ;
            const changes = (result as any).changes || (result as any).meta.changes || 0;
            if (changes === 0)  {
                 return new Response(JSON.stringify({ error: "Kabul edilecek bekleyen istek bulunamadı." }), { status: 404 });
             }

            return new Response(JSON.stringify({ message: "Arkadaşlık isteği kabul edildi.", status: 'accepted' }), { status: 200 });
        }


        else if (newStatus === 'blocked') { 
    // YENİ EKLENEN BLOCKED MANTIĞI: Var olan ilişkiyi 'blocked' durumuna günceller.
            const blockQuery = env.BAYKUS_DB.prepare(
            `UPDATE friends SET status = ?, updated_at = ? WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`
            );
             // Hem normal sıralamayı (user1, user2) hem de ters sıralamayı (user2, user1) kontrol ederek güncelleriz.
            const result = (await blockQuery.bind(newStatus, new Date().toISOString(), user1, user2, user2, user1).run());
            const changes =(result as any).changes || (result as any).meta.changes || 0;
                if (changes === 0) {
                // Eğer güncellenen bir kayıt yoksa (yani yeni engelleme)
                    return new Response(JSON.stringify({ error: "Engellenecek mevcut bir ilişki bulunamadı." }), { status: 404 });
                }
        return new Response(JSON.stringify({ message: "Kullanıcı başarıyla engellendi.", status: 'blocked' }), { status: 200 });
        }

        return new Response(JSON.stringify({ message: `Durum güncellendi: ${newStatus}` }), { status: 200 });

    } 
    
    catch (error) {
        console.error("Durum güncelleme hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}