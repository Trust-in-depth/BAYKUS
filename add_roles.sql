-- add_roles.sql

-- 1. ROLES Tablosu: Rol tanımlarını ve izinlerini tutar.
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    name TEXT NOT NULL,         -- Rolün adı (Örn: Yardımcı, Aslan)
    permissions INTEGER NOT NULL, -- İzinlerin Bitmask değeri (Çıkarma, Yasaklama yetkileri)
    is_default BOOLEAN DEFAULT FALSE, -- Yeni üyelere otomatik atanır mı?
    FOREIGN KEY (server_id) REFERENCES servers(id),
    UNIQUE (server_id, name)
);

-- 2. MEMBER_ROLES Tablosu: Hangi üyenin hangi role sahip olduğunu bağlar.
CREATE TABLE IF NOT EXISTS member_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    PRIMARY KEY (user_id, role_id, server_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (server_id) REFERENCES servers(id)
);
