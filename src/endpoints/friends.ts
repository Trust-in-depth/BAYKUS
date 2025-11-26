// src/endpoints/friends.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt'; 

// Gelen JSON gövdesinin yapısı
interface AddFriendBody {
    receiverUsername: string;
}

export async function handleAddFriend(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { receiverUsername } = await request.json() as AddFriendBody;
        if (!receiverUsername || receiverUsername === payload.username) {
            return new Response(JSON.stringify({ error: "Geçerli bir kullanıcı adı gerekli." }), { status: 400 });
        }
        
        const senderId = payload.userId;
        
        // 1. Alıcı Kullanıcı ID'sini Bulma
        const receiverResult = await env.BAYKUS_DB.prepare("SELECT id FROM users WHERE username = ?").bind(receiverUsername).first('id');
        if (!receiverResult) {
            return new Response(JSON.stringify({ error: "Kullanıcı bulunamadı." }), { status: 404 });
        }
        const receiverId = receiverResult as string;

        // 2. Arkadaşlık İsteğini Kaydetme (friends tablosu)
        // user_id < friend_id kuralına uymak için sıralama yapmalıyız
        const user1 = senderId < receiverId ? senderId : receiverId;
        const user2 = senderId > receiverId ? senderId : receiverId;

        await env.BAYKUS_DB.prepare(
            "INSERT INTO friends (id, user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(crypto.randomUUID(), user1, user2, 'pending', new Date().toISOString()).run();

        return new Response(JSON.stringify({ message: "Arkadaşlık isteği gönderildi.", receiverId: receiverId }), { status: 201 });

    } catch (error) {
        console.error("Arkadaş ekleme hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}