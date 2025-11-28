// src/endpoints/files.ts

import { Env } from '../types';
import { AuthPayload } from '../auth/jwt'; 

// Dosya yükleme (resim, video vb.) işlemini yönetir
export async function handleFileUpload(request: Request, env: Env, payload: AuthPayload): Promise<Response> {
    try {
        const userId = payload.userId;
        const contentType = request.headers.get('Content-Type');
        
        if (!request.body || !contentType) {
             return new Response(JSON.stringify({ error: "Dosya içeriği eksik." }), { status: 400 });
        }

        // Dosya adı veya ID'si oluşturulur
        const fileId = `${crypto.randomUUID()}-${Date.now()}`;
        const objectName = `users/${userId}/media/${fileId}`;

        // KRİTİK: Dosyayı doğrudan R2'ye yükleme
        await env.MEDIA_FILES.put(objectName, request.body, {
            // İsteğe bağlı: Dosya tipini (MIME Type) kaydetme
            httpMetadata: { contentType: contentType },
        });

        // Frontend'e dosyanın URL'sini döndürme
        // R2'nin genel erişime açık bir ön eki olduğunu varsayıyoruz (Cloudflare Pages/Workers üzerinden erişim için)
        const fileUrl = `/media/${objectName}`; 

        return new Response(JSON.stringify({ 
            message: "Dosya başarıyla yüklendi.", 
            fileId: objectName,
            url: fileUrl 
        }), { status: 201 });

    } catch (error) {
        console.error("Dosya yükleme hatası:", error);
        return new Response(JSON.stringify({ error: "Sunucu hatası." }), { status: 500 });
    }
}