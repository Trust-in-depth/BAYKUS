// src/auth/permissions.ts
// src/auth/permissions.ts - Baykuş Projesi için Düzeltilmiş ve Genişletilmiş İzinler

export const PERMISSIONS = {
    // -------------------------------------------------------------
    // I. GENEL YÖNETİCİLİK İZİNLERİ (Server Çapında)
    // -------------------------------------------------------------
    
    // Tüm yetkileri verir. Sadece Owner/System Admin kullanmalıdır.
    ADMINISTRATOR: 2147483647, 
    
    // TEMEL YÖNETİM
    VIEW_AUDIT_LOG: 1 << 0,  // 1 (Denetim Kaydını Görme)
    MANAGE_SERVER:  1 << 1,  // 2 (Sunucu adını/bölgesini değiştirme)
    MANAGE_ROLES:   1 << 2,  // 4 (Rolleri oluşturma/silme/atama)
    MANAGE_CHANNELS:1 << 3,  // 8 (Kanal oluşturma/silme/düzenleme)
    KICK_MEMBERS:   1 << 4,  // 16 (Üyeyi sunucudan atma)
    BAN_MEMBERS:    1 << 5,  // 32 (Üyeyi yasaklama)
    
    // -------------------------------------------------------------
    // II. METİN VE MESAJ YETKİLERİ
    // -------------------------------------------------------------

    SEND_MESSAGES:     1 << 6,  // 64 (Metin kanallarına mesaj gönderme)
    MANAGE_MESSAGES:   1 << 7,  // 128 (Başkalarının mesajlarını silme)
    READ_MESSAGE_HISTORY: 1 << 8, // 256 (Geçmiş mesajları görme/okuma)
    EMBED_LINKS:       1 << 9,  // 512 (Bağlantıları yerleştirme)
    ATTACH_FILES:      1 << 10, // 1024 (Medya/Dosya gönderme/R2'ye yükleme)
    
    // -------------------------------------------------------------
    // III. SES VE GÖRÜNTÜ YETKİLERİ (SFU/TURN Katmanı)
    // -------------------------------------------------------------

    CONNECT:           1 << 11, // 2048 (Sesli/Görüntülü kanala katılma)
    SPEAK:             1 << 12, // 4096 (Sesli kanalda konuşma)
    MUTE_MEMBERS:      1 << 13, // 8192 (Başkalarını sesli kanalda susturma)
    DEAFEN_MEMBERS:    1 << 14, // 16384 (Başkalarının sesini kapatma)
    STREAM:            1 << 15, // 32768 (Ekran paylaşımı/Video yayınlama)
    
    // -------------------------------------------------------------
    // IV. ÜYELİK VE İLETİŞİM
    // -------------------------------------------------------------

    CHANGE_NICKNAME:   1 << 16, // 65536 (Kendi Nickname'ini değiştirme)
    MENTION_EVERYONE:  1 << 17, // 131072 (@everyone / @here yapma)
};