// Gerekli tipleri ve D1'i env üzerinden alıyoruz
interface Env {
    BAYKUS_DB: D1Database;
    // ... (Diğer bindingler)
}

// 90 gün (saniye cinsinden)
//const NINETY_DAYS_IN_SECONDS = 30 Test Ayarı: 30 saniye öncesinde oluşmuş  left_at kayıtlarına bakıp siler
const NINETY_DAYS_IN_SECONDS = 90 * 24 * 60 * 60; 

export default {
    // CRON tarafından tetiklenen ana fonksiyon
    async scheduled(controller: ScheduledController, env: Env): Promise<void> {
        
        const nowInSeconds = Math.floor(Date.now() / 1000);
        // 90 gün önceki Unix zaman damgası
        const ninetyDaysAgo = nowInSeconds - NINETY_DAYS_IN_SECONDS; 
        
        console.log(`Starting cleanup for members inactive since ${ninetyDaysAgo}`);

        // SQL Mantığı: left_at (ayrılma zamanı) 90 günden eskiyse ve NULL değilse sil.
        await env.BAYKUS_DB.prepare(
            `DELETE FROM server_members 
             WHERE left_at IS NOT NULL 
             AND left_at < ?`
        ).bind(ninetyDaysAgo).run();
        
        console.log("Eski pasif üyelikler başarıyla temizlendi.");
    },

    // Workers tarafından tetiklenen fetch fonksiyonu (boş bırakılabilir)
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return new Response("Cleanup Worker is running in the background.", { status: 200 });
    }
};