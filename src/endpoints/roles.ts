// src/endpoints/roles.ts
import { Env } from '../types';
import { AuthPayload } from '../auth/jwt'; 
import { PERMISSIONS } from '../auth/permissions'; 

interface AssignRoleBody {
    serverId: string;
    targetUserId: string; // Rolün atanacağı kullanıcı
    roleId: string;       // Atanacak rolün ID'si
}
interface CreateRoleBody {
    serverId: string;
    roleName: string;
    permissions: number; // Bitmask olarak gelen izin değeri
}


export async function handleAssignRole(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId, targetUserId, roleId } = await request.json() as AssignRoleBody;
        const actingUserId = payload.userId; // İşlemi yapan yönetici
        const assignedAt = new Date().toISOString();

        if (!serverId || !targetUserId || !roleId) {
            return new Response(JSON.stringify({ error: "Sunucu, hedef kullanıcı veya rol bilgisi eksik." }), { status: 400 });
        }

        // --- ADIM 1: YETKİ KONTROLÜ (KRİTİK) ---
        // Yöneticinin (actingUserId), Rol Atama (MANAGE_ROLES) yetkisine sahip olup olmadığını kontrol et.
        const userPermissions = await env.BAYKUS_DB.prepare(`
            SELECT SUM(T2.permissions) AS total_permissions
            FROM member_roles AS T1
            JOIN roles AS T2 ON T1.role_id = T2.role_id
            WHERE T1.user_id = ? AND T1.server_id = ? AND T1.left_at IS NULL
        `).bind(actingUserId, serverId).first<{ total_permissions: number }>();
        
        const totalPermissions = userPermissions?.total_permissions || 0;
        
        // MANAGE_ROLES (4) izni olmayanlar reddedilir.
        if ((totalPermissions & PERMISSIONS.MANAGE_ROLES) === 0) { 
            return new Response(JSON.stringify({ error: "Rol atama yetkiniz yok (MANAGE_ROLES izni gerekli)." }), { status: 403 });
        }

        // --- ADIM 2: HEDEF VE ROL VARLIK KONTROLÜ ---
        // Rolün ve hedef kullanıcının sunucuda var olduğunu kontrol et.
        const [targetMember, role] = await env.BAYKUS_DB.batch([
            env.BAYKUS_DB.prepare("SELECT user_id FROM server_members WHERE user_id = ? AND server_id = ? AND left_at IS NULL").bind(targetUserId, serverId),
            env.BAYKUS_DB.prepare("SELECT role_id, permissions FROM roles WHERE role_id = ? AND server_id = ?").bind(roleId, serverId),
        ]);

        if (!targetMember.results || targetMember.results.length === 0) {
            return new Response(JSON.stringify({ error: "Hedef kullanıcı sunucuda aktif değil." }), { status: 404 });
        }
        if (!role.results || role.results.length === 0) {
            return new Response(JSON.stringify({ error: "Atanacak rol bulunamadı." }), { status: 404 });
        }
        
        // --- ADIM 3: ROLÜ ATAMA (INSERT) ---
        const memberRoleIdPK = crypto.randomUUID(); 
        
        const insertStatement = env.BAYKUS_DB.prepare(
            `INSERT INTO member_roles (member_role_id, user_id, role_id, server_id, assigned_at, left_at) 
             VALUES (?, ?, ?, ?, ?, NULL)`
        ).bind(memberRoleIdPK, targetUserId, roleId, serverId, assignedAt);
        
        await insertStatement.run();

        // --- ADIM 4: NDO BİLDİRİMİ (Opsiyonel) ---
        // Rol atamasının gerçekleştiğini kullanıcılara duyur. (Basitlik için bu aşamada atlanabilir, ancak önemlidir.)
        
        return new Response(JSON.stringify({ 
            message: "Rol başarıyla atandı.", 
            assignedTo: targetUserId,
            roleId: roleId
        }), { status: 200 });

    } catch (error) {
        console.error("Rol atama hatası:", error);
        return new Response(JSON.stringify({ error: "Rol atama işlemi başarısız oldu." }), { status: 500 });
    }
}



// src/endpoints/roles.ts


export async function handleCreateRole(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { serverId, roleName, permissions } = await request.json() as CreateRoleBody;
        const userId = payload.userId; // İşlemi yapan yönetici
        
        // ... (Kullanıcının MANAGE_ROLES (4) iznine sahip olup olmadığını kontrol eden ADIM 1 kodunu buraya kopyalayın) ...
        // Eğer izin yoksa 403 ile reddedin.

        // ... (Örnek Yetki Kontrolü Kodu) ...
        const userPermissions = await env.BAYKUS_DB.prepare(`
            SELECT SUM(T2.permissions) AS total_permissions
            FROM member_roles AS T1
            JOIN roles AS T2 ON T1.role_id = T2.role_id
            WHERE T1.user_id = ? AND T1.server_id = ? AND T1.left_at IS NULL
        `).bind(userId, serverId).first<{ total_permissions: number }>();
        
        const totalPermissions = userPermissions?.total_permissions || 0;
        if ((totalPermissions & PERMISSIONS.MANAGE_ROLES) === 0) { 
            return new Response(JSON.stringify({ error: "Rol oluşturma yetkiniz yok (MANAGE_ROLES izni gerekli)." }), { status: 403 });
        }
        // ... (Yetki Kontrolü Bitti) ...


        // --- ADIM 2: ROLÜ OLUŞTURMA (INSERT) ---
        const newRoleId = crypto.randomUUID();

        const insertStatement = env.BAYKUS_DB.prepare(
            `INSERT INTO roles (role_id, server_id, role_name, permissions, is_default) 
             VALUES (?, ?, ?, ?, FALSE)` // FALSE: Yeni oluşturulan rol default olamaz.
        ).bind(newRoleId, serverId, roleName, permissions);
        
        await insertStatement.run();
        
        return new Response(JSON.stringify({ 
            message: "Rol başarıyla oluşturuldu.", 
            roleId: newRoleId,
            permissions: permissions
        }), { status: 201 });

    } catch (error) {
        console.error("Rol oluşturma hatası:", error);
        return new Response(JSON.stringify({ error: "Rol oluşturma işlemi başarısız oldu." }), { status: 500 });
    }
}


