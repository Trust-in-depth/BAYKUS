import { Env } from '../types';
import * as jose from 'jose'; 

// JWT'den çözümlenen kimlik bilgileri yapısı
export interface AuthPayload {
    userId: string;
    username: string;
}

export async function verifyAndDecodeJwt(token: string, env: Env): Promise<AuthPayload | null> {
    try {
        const secret = new TextEncoder().encode(env.JWT_SECRET);
        
        // JWT'yi doğrulama ve içeriğini (payload) çözme
        const { payload } = await jose.jwtVerify(token, secret, {
            issuer: 'baykus-auth-service',
            audience: 'baykus-platform',
        });

        // Payload'dan gerekli bilgileri çekme
        const userId = payload['urn:baykus:uid'] as string;
        const username = payload['urn:baykus:name'] as string;

        if (userId && username) {
            return { userId, username };
        }

        return null;
        
    } catch (e) {
        // Token geçersizse veya süresi dolmuşsa
        console.warn("JWT Doğrulama Hatası:", e);
        return null;
    }
}