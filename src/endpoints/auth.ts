// src/endpoints/auth.ts

import { Env } from '../types';
import * as jose from 'jose'; 
import { AuthPayload } from '../auth/jwt';
import { date } from 'zod/v4';

// Giriş (Login) için beklenen JSON yapısı
interface LoginBody {
    email: string;
    password: string;
}

interface RegisterBody {
    email: string;
    password: string;
    username: string;
}
// Varsayım: Bu fonksiyonlar, güvenli hashleme ve JWT oluşturma/doğrulama işlemini yapar.
// Gerçek projede bcrypt/Argon2 kullanmalısınız.
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// KAYIT (REGISTER)
export async function handleRegister(request: Request, env: Env): Promise<Response> {
    try {
        // Tip ataması kullanılarak body'den gerekli veriler alınır.
        const { email, password, username } = await request.json() as RegisterBody;
        
        if (!email || !password || !username) {
            return new Response(JSON.stringify({ error: "Gerekli alanlar eksik." }), { status: 400 });
        }
        
        // E-mail Benzersizlik Kontrolü

    const existingUser = await env.BAYKUS_DB.prepare("SELECT user_id FROM users WHERE email = ?").bind(email).first('user_id');
    if (existingUser) {
        // Mesajı daha genel ve güvenli hale getir
        return new Response(JSON.stringify({ 
            error: "Kayıt işlemi başarısız oldu. Lütfen girdiğiniz bilgileri kontrol edin." 
        }), { status: 409 }); 
    }

        const hashedPassword = await hashPassword(password);
        const userId = crypto.randomUUID();
        const lowerCaseUsername = username.toLowerCase(); 

// 1. users tablosuna kayıt (user_id, username, email, hashed_password)
        await env.BAYKUS_DB.prepare(
            "INSERT INTO users (user_id, email, hashed_password, username, created_at) VALUES (?, ?, ?, ?, datetime('now') )"
        ).bind(userId, email, hashedPassword, lowerCaseUsername).run();
        
        // 2. user_details tablosuna kayıt (İlk Profil ve Varsayılan Durum)
        await env.BAYKUS_DB.prepare(
            "INSERT INTO user_details (user_id, nick_name, online_status_id) VALUES (?, ?, 'STATUS_OFFLINE')"
        ).bind(userId, username).run();


// 3. Password Geçmişine Kayıt (history_of_password)
        await env.BAYKUS_DB.prepare(
             "INSERT INTO history_of_password (history_id, user_id, hashed_password) VALUES (?, ?, ?)"
        ).bind(crypto.randomUUID(), userId, hashedPassword).run();
        return new Response(JSON.stringify({ message: "Kayıt başarılı.", userId: userId }), { status: 201 });

    } catch (error) {
        console.error("Kayıt hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}

// GİRİŞ (LOGIN)
// src/endpoints/auth.ts (handleLogin fonksiyonu)

export async function handleLogin(request: Request, env: Env): Promise<Response> {
    try {
        const { email, password } = await request.json() as LoginBody;
        
        // 1. users tablosundan şifre ve user_id'yi çekme
        const userAuthResult = await env.BAYKUS_DB.prepare(
            // user_id, hashed_password ve username (küçük harfli) çekiliyor
            "SELECT user_id, hashed_password, username FROM users WHERE email = ?"
        ).bind(email).all();
        
        if (userAuthResult.results.length === 0) {
            return new Response(JSON.stringify({ error: "E-posta veya şifre hatalı." }), { status: 401 });
        }
        
        const authData = userAuthResult.results[0] as { user_id: string, hashed_password: string, username: string };
        const submittedHash = await hashPassword(password);

        if (submittedHash !== authData.hashed_password) {
             return new Response(JSON.stringify({ error: "E-posta veya şifre hatalı." }), { status: 401 });
        }

        // 2. user_details tablosundan görünen adı (nick_name) çekme
        const detailsResult = await env.BAYKUS_DB.prepare(
            "SELECT nick_name FROM user_details WHERE user_id = ?"
        ).bind(authData.user_id).first('nick_name');

        const nickName = detailsResult || authData.username; // Eğer nick_name yoksa, username kullanılır.


// --- YENİ ADIM 1: D1'DE ONLINE DURUMUNU GÜNCELLE ---
        await env.BAYKUS_DB.prepare(
            "UPDATE user_details SET online_status_id = 'STATUS_ONLINE' WHERE user_id = ?"
        ).bind(authData.user_id).run();
        
        // --- YENİ ADIM 2: NDO YAYINI İÇİN PAYLOAD HAZIRLA ---
        
        const messagePayload = {
            type: "PRESENCE_UPDATE",
            data: {
                action: "ONLINE", // Ya da JOIN, ancak login için ONLINE daha spesifiktir
                userId: authData.user_id,
                username: authData.username,
                nickName: nickName,
                timestamp: Date.now()
            }
        };

        const notificationId = env.NOTIFICATION.idFromName("global"); 
        const notificationStub = env.NOTIFICATION.get(notificationId);
        
        // Asenkron yayınlama (Worker'ın /presence rotasını tetikler)
        await notificationStub.fetch("/presence", { 
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messagePayload),
        }).catch(e => console.error(`Login bildirimi yayınlanırken hata oluştu:`, e));



        // 3. JWT Oluşturma (user_id ve nick_name kullanılır)
        const secret = new TextEncoder().encode(env.JWT_SECRET); 
        const alg = 'HS256';

        const jwt = await new jose.SignJWT({ 
            'urn:baykus:uid': authData.user_id, // Yeni sütun adı: user_id
            'urn:baykus:name': nickName,
        })
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setIssuer('baykus-auth-service')
        .setAudience('baykus-platform')
        .setExpirationTime('24h')
        .sign(secret);

        return new Response(JSON.stringify({ 
            token: jwt, 
            user: { 
                userId: authData.user_id, 
                username: authData.username,
                nickName: nickName
            } 
        }), { status: 200 });

    } catch (error) {
        console.error("Giriş hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}