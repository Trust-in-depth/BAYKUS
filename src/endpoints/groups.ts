// src/endpoints/groups.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt'; 

// JSON gövdesinde beklenenler: Grup adı ve eklenecek üyelerin listesi.
interface CreateGroupBody {
    groupName: string;
    memberIds: string[]; // Eklenecek üye ID'leri
}

export async function handleCreateGroup(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { groupName, memberIds } = await request.json() as CreateGroupBody;
        const ownerId = payload.userId;

        if (!groupName || !memberIds || memberIds.length === 0) {
            return new Response(JSON.stringify({ error: "Grup adı ve üye listesi gereklidir." }), { status: 400 });
        }
        
        // 1. D1'de yeni grup kanalını oluştur (group_channels)
        const groupId = crypto.randomUUID();
        await env.BAYKUS_DB.prepare(
            "INSERT INTO group_channels (id, owner_id, name, created_at) VALUES (?, ?, ?, strftime('%s','now'))"
        ).bind(groupId, ownerId, groupName).run();
        
        // 2. Gruba üyeleri ekle (group_members)
        const allMembers = [ownerId, ...memberIds]; // Sahibi de listeye ekle
        
        // Tüm üyeleri tek bir işlemde eklemek için toplu sorgu (Batch Statement) kullanırız.
        const memberStatements = allMembers.map(memberId => 
            env.BAYKUS_DB.prepare(
                "INSERT INTO group_members (id, group_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, strftime('%s','now'))"
            ).bind(crypto.randomUUID(), groupId, memberId, memberId === ownerId ? 'owner' : 'member')
        );

        await env.BAYKUS_DB.batch(memberStatements); // Tüm sorguları tek seferde çalıştır

        // 3. Başarılı yanıt
        return new Response(JSON.stringify({
            message: "Grup sohbeti başarıyla oluşturuldu.",
            groupId: groupId
        }), { status: 201 });

    } catch (error) {
        console.error("Grup oluşturma hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}