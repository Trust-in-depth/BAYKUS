// src/endpoints/voice.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt';

// Gelen veri için basit bir tip tanımlayalım
interface ChannelBody {
    channelId: string;
}

// 1. TURN/STUN Bilgilerini Çekme
export async function handleGetTurnCredentials(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    // BURAYA GERÇEK HMAC ve Cloudflare SFU/TURN KULLANIMI GELECEKTİR. 
    // Şimdilik sadece gerekli yapıyı döndürüyoruz.
    const TURN_TTL = 3600;
    const username = `${Math.floor(Date.now() / 1000) + TURN_TTL}:${payload.userId}`;
    
    // Gerçek uygulamada, env.JWT_SECRET ile karmaşık bir password üretilmelidir.
    const fakePassword = 'fake-password-' + payload.userId.substring(0, 8); 

    return new Response(JSON.stringify({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
                urls: ['turn:turn.yourdomain.com:443'], // Cloudflare TURN URL'si
                username: username,
                credential: fakePassword
            }
        ]
    }), { status: 200 });
}

// 2. Sesli Kanala Giriş
export async function handleJoinVoiceChannel(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const { channelId } = await request.json() as ChannelBody;
        const userId = payload.userId;

        // Önceki oturumu sonlandır (bir kullanıcı aynı anda tek bir sesli kanalda olabilir)
        await env.BAYKUS_DB.prepare("UPDATE voice_activity SET left_at = ? WHERE user_id = ? AND left_at IS NULL")
            .bind(new Date().toISOString(), userId).run();

        // Yeni Giriş Kaydı Oluşturma
        await env.BAYKUS_DB.prepare(
            "INSERT INTO voice_activity (id, channel_id, user_id, joined_at, left_at) VALUES (?, ?, ?, ?, NULL)"
        ).bind(crypto.randomUUID(), channelId, userId, new Date().toISOString()).run();

        // Not: Gerçek uygulamada, ilgili Durable Object'e (sesli kanal durumu) bir 'JOIN' mesajı gönderilmelidir.

        return new Response(JSON.stringify({ message: "Kanala katıldı." }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: "Giriş başarısız." }), { status: 500 });
    }
}

// 3. Sesli Kanaldan Ayrılma
export async function handleLeaveVoiceChannel(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const userId = payload.userId;

        // Aktif oturumu sonlandırma (left_at sütununu güncelleme)
        await env.BAYKUS_DB.prepare(
            "UPDATE voice_activity SET left_at = ? WHERE user_id = ? AND left_at IS NULL"
        ).bind(new Date().toISOString(), userId).run();

        // Not: Gerçek uygulamada, ilgili Durable Object'e bir 'LEAVE' mesajı gönderilmelidir.
        
        return new Response(JSON.stringify({ message: "Kanaldan ayrıldı." }), { status: 200 });

    } catch (e) {
        return new Response(JSON.stringify({ error: "Ayrılma başarısız." }), { status: 500 });
    }
}