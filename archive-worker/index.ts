//archive-worker/index.ts

// Not: Bu Worker'ın Env'de sadece R2 binding'ini (MEDIA_FILES) ve gerekirse diğer R2/D1 bindinglerini içerdiğini varsayıyoruz.

// Bu Worker'ın sadece R2'ye eriştiği ve başka bir Workers servisi olduğu için 
// bu Worker'a özel Env tipi burada da tanımlanmalıdır.
interface ArchiveEnv {
    MEDIA_FILES: R2Bucket; // R2 depolama binding'i
    // ... (Eğer messages için ayrı R2 bucket'ı varsa, o da burada olmalı)
}

export default {
    async fetch(request: Request, env: ArchiveEnv, ctx: ExecutionContext): Promise<Response> {
        
        // Sadece ana Workers'tan gelen POST isteklerini işler
        if (request.url.endsWith("/archive/messages") && request.method === "POST") {
            try {
                // 1. Gelen Veriyi Çözme (DO'dan gelen JSON)
                const { roomId, messages } = await request.json();
                
                if (!messages || messages.length === 0) {
                    return new Response("No messages to archive.", { status: 200 });
                }

                // 2. Arşiv Dosyası Adı Oluşturma
                // Dosya adı, Oda ID'si ve zaman damgası içerir.
                const archiveId = `archive/room/${roomId}/${Date.now()}.json`;

                // 3. Dosyayı R2'ye Yükleme (Kritik R2 I/O işlemi)
                await env.MEDIA_FILES.put(archiveId, JSON.stringify(messages), {
                    httpMetadata: { contentType: 'application/json' },
                    // R2'de kalıcı olması için gerekli ayarlar
                });

                console.log(`Successfully archived ${messages.length} messages for room ${roomId} to R2.`);
                
                return new Response("Archive successful", { status: 200 });

            } catch (e) {
                console.error("R2 Arşivleme hatası:", e);
                // Eğer R2 yüklemesi başarısız olursa, bir 500 hatası döndürmek önemlidir.
                return new Response("Archiving failed: Internal error.", { status: 500 });
            }
        }
        
        return new Response("Archive Worker: Not Found", { status: 404 });
    }
}