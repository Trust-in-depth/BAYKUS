// src/auth/permissions.ts

// Bir kullanıcının sahip olabileceği temel yetkiler
export const PERMISSIONS = {
    // Yöneticilik Yetkileri (Sunucu çapında)
    ADMINISTRATOR: 2147483647, // Tüm yetkileri verir (Örn: Max Integer)
    KICK_MEMBERS: 1,           // Üyeyi sunucudan atma
    BAN_MEMBERS: 2,            // Üyeyi yasaklama
    MANAGE_ROLES: 4,           // Rolleri yönetme / Atama
    
    // Metin Kanalı Yetkileri
    SEND_MESSAGES: 256,
    MANAGE_MESSAGES: 512,
};