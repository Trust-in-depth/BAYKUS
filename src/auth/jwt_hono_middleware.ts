// src/auth/jwt_hono_middleware.ts (Final Versiyon)

import { Context, Next } from 'hono';
import { Env } from '../types'; 
// verifyAndDecodeJwt ve AuthPayload'ı, jwt.ts dosyanızdan doğru şekilde içe aktarın.
import { verifyAndDecodeJwt, AuthPayload } from './jwt'; 

// 1. ADIM: Context'e ekleyeceğimiz değişkenlerin (Vars) tipini tanımlıyoruz
// Bu, c.set/c.get ile taşınacak veridir.
export type AppVariables = {
    // JWT ile doğrulanan kullanıcının yükünü taşıyan alan
    userPayload: AuthPayload; 
};

// 2. ADIM: Middleware ve Rotalarda Kullanılacak Global Context Tipini Tanımlıyoruz
// Bu tip, hem Env binding'lerini hem de AppVariables'ı içerir.
export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

// 3. ADIM: Middleware fonksiyonu
export const jwtAuthMiddleware = async (c: AppContext, next: Next) => {
    
    // Hono'da başlığı çekmenin en yaygın yollarından biri.
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: "Yetkilendirme gerekli." }, 401);
    }

    const token = authHeader.substring(7);
    
    // JWT'yi çözme ve doğrulama
    const payload = await verifyAndDecodeJwt(token, c.env);
    
    if (!payload) {
        return c.json({ error: "Geçersiz veya süresi dolmuş token." }, 401);
    }

    // 4. ADIM: Veriyi c.set ile kaydet
    // Artık AppContext tipi 'userPayload'ı resmi olarak tanıdığı için hata çözülür.
    c.set('userPayload', payload); 
    
    // İsteği bir sonraki rotaya devret
    await next();
};