// src/endpoints/auth.ts

import { Env } from '../types';
import * as jose from 'jose'; 
import { AuthPayload } from '../auth/jwt';

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
        const body = await request.json() as { email?: string; password?: string; username?: string };
        const { email, password, username } = body as RegisterBody ;
        if (!email || !password || !username) {
            return new Response(JSON.stringify({ error: "Gerekli alanlar eksik." }), { status: 400 });
        }
        
        // E-mail Benzersizlik Kontrolü (Veritabanında UNIQUE kısıtlaması olmadığı için kodda kontrol şarttır)
        const existingUser = await env.BAYKUS_DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first('id');
        if (existingUser) {
            return new Response(JSON.stringify({ error: "E-posta zaten kayıtlı." }), { status: 409 });
        }

        const hashedPassword = await hashPassword(password);
        const userId = crypto.randomUUID();

        await env.BAYKUS_DB.prepare(
            "INSERT INTO users (id, email, hashed_password, username, name, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(userId, email, hashedPassword, username, username, new Date().toISOString()).run();
        
        return new Response(JSON.stringify({ message: "Kayıt başarılı.", userId: userId }), { status: 201 });

    } catch (error) {
        console.error("Kayıt hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}

// GİRİŞ (LOGIN)
export async function handleLogin(request: Request, env: Env): Promise<Response> {
    try {
        const { email, password } = await request.json() as LoginBody;
        
        const userResult = await env.BAYKUS_DB.prepare(
            "SELECT id, hashed_password, username FROM users WHERE email = ?"
        ).bind(email).all();
        
        if (userResult.results.length === 0) {
            return new Response(JSON.stringify({ error: "E-posta veya şifre hatalı." }), { status: 401 });
        }
        
        const user = userResult.results[0] as { id: string, hashed_password: string, username: string };
        const submittedHash = await hashPassword(password);

        if (submittedHash !== user.hashed_password) {
             return new Response(JSON.stringify({ error: "E-posta veya şifre hatalı." }), { status: 401 });
        }

        // JWT Oluşturma
        const secret = new TextEncoder().encode(env.JWT_SECRET); 
        const alg = 'HS256';

        const jwt = await new jose.SignJWT({ 
            'urn:baykus:uid': user.id, // User ID
            'urn:baykus:name': user.username,
        })
        .setProtectedHeader({ alg })
        .setExpirationTime('24h')
        .sign(secret);

        return new Response(JSON.stringify({ token: jwt, user: { id: user.id, username: user.username } }), { status: 200 });

    } catch (error) {
        console.error("Giriş hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}