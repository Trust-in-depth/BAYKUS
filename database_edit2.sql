-- #######################################################################
-- # 1. BAŞLANGIÇ VE KONTROL KOMUTLARI
-- #######################################################################
PRAGMA foreign_keys = OFF;

-- Tüm eski tabloları siler (Yeni şema uygulanmadan önce temizlik)
DROP TABLE IF EXISTS history_of_password;
DROP TABLE IF EXISTS user_details;
DROP TABLE IF EXISTS users;

DROP TABLE IF EXISTS servers;
DROP TABLE IF EXISTS server_details;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS channel_details;
DROP TABLE IF EXISTS roles;

DROP TABLE IF EXISTS regions;
DROP TABLE IF EXISTS channels_types;
DROP TABLE IF EXISTS friends_status;
DROP TABLE IF EXISTS online_status;

DROP TABLE IF EXISTS server_members;
DROP TABLE IF EXISTS voice_activity;
DROP TABLE IF EXISTS channel_members;
DROP TABLE IF EXISTS member_roles;
DROP TABLE IF EXISTS friends;

DROP TABLE IF EXISTS media_files;
DROP TABLE IF EXISTS channel_messages;
DROP TABLE IF EXISTS sistem_kayitlari;
DROP TABLE IF EXISTS user_notes;

DROP TABLE IF EXISTS dm_channels;
DROP TABLE IF EXISTS dm_messages;
DROP TABLE IF EXISTS group_channels;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS group_messages;


-- #######################################################################
-- # 2. LOOKUP VE TEMEL VARLIKLAR (FK SIRASINA GÖRE)
-- #######################################################################

-- LOOKUP TABLOLARI (Önce oluşturulmalı)
CREATE TABLE IF NOT EXISTS regions ( 
    region_id TEXT PRIMARY KEY, 
    region_name TEXT UNIQUE NOT NULL );


CREATE TABLE IF NOT EXISTS channels_types( 
    channel_type_id TEXT PRIMARY KEY, 
    channel_type_name TEXT UNIQUE NOT NULL );


CREATE TABLE IF NOT EXISTS friends_status ( 
    status_id TEXT PRIMARY KEY, 
    status_name TEXT UNIQUE NOT NULL );


CREATE TABLE IF NOT EXISTS online_status ( 
    status_id TEXT PRIMARY KEY, 
    status_name TEXT UNIQUE NOT NULL, 
    status_icon_url TEXT );




-- TEMEL VARLIKLAR
CREATE TABLE IF NOT EXISTS users ( 
    user_id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')) );


CREATE TABLE IF NOT EXISTS history_of_password (
    history_id TEXT PRIMARY KEY, 
    user_id TEXT NOT NULL,
    hashed_password TEXT NOT NULL, 
    changed_at TEXT DEFAULT (datetime('now')),
    
     FOREIGN KEY (user_id) REFERENCES users(user_id) );



CREATE TABLE IF NOT EXISTS user_details ( 
    user_id TEXT PRIMARY KEY, 
    nick_name TEXT, 
    avatar_url TEXT, 
    region_id TEXT, 
    online_status_id TEXT DEFAULT 'STATUS_OFFLINE', 

    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (region_id) REFERENCES regions(region_id),
    FOREIGN KEY (online_status_id) REFERENCES online_status(status_id) );

-- SUNUCU TEMELLİ YAPILAR (SIRALAMA DÜZELTİLDİ)
CREATE TABLE IF NOT EXISTS servers ( 
    server_id TEXT PRIMARY KEY, 
    owner_id TEXT NOT NULL, 
    server_name TEXT NOT NULL, 
    created_at TEXT DEFAULT (datetime('now')) , 
    
    FOREIGN KEY (owner_id) REFERENCES users(user_id), 
    UNIQUE (server_name, owner_id) );

-- #######################################################################
-- # 3. CHANNELS ÖNCE, SONRA SERVER_DETAILS (KRİTİK DÜZELTME)
-- #######################################################################

CREATE TABLE IF NOT EXISTS channels ( 
    channel_id TEXT PRIMARY KEY, 
    server_id TEXT NOT NULL, 
    channel_type_id TEXT NOT NULL, 
    channel_name TEXT NOT NULL, 
    created_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (server_id) REFERENCES servers(server_id), 
    FOREIGN KEY (channel_type_id) REFERENCES channels_types(channel_type_id), 
    UNIQUE (server_id, channel_name)
);


CREATE TABLE IF NOT EXISTS server_details ( 
    server_id TEXT PRIMARY KEY, 
    welcome_message TEXT, 
    system_log_channel_id TEXT, 
    ban_list_path_r2 TEXT, 

    FOREIGN KEY (server_id) REFERENCES servers(server_id), 
    FOREIGN KEY (system_log_channel_id) REFERENCES channels(channel_id) 
);


CREATE TABLE IF NOT EXISTS channel_details ( 
    channel_id TEXT PRIMARY KEY, 
    topic TEXT, 
    slow_mode_seconds INTEGER DEFAULT 0, 
    archive_path_r2 TEXT, 

    FOREIGN KEY (channel_id) REFERENCES channels(channel_id)
);



CREATE TABLE IF NOT EXISTS roles ( 
    role_id TEXT PRIMARY KEY, 
    server_id TEXT NOT NULL, 
    role_name TEXT NOT NULL, 
    permissions INTEGER NOT NULL, 
    is_default BOOLEAN DEFAULT FALSE, 

    FOREIGN KEY (server_id) REFERENCES servers(server_id), 
    UNIQUE (server_id, role_name)
);


-- #######################################################################
-- # 4. İLİŞKİ VE MESSAJLAŞMA TABLOLARI
-- #######################################################################

CREATE TABLE IF NOT EXISTS server_members ( 
    server_id TEXT NOT NULL, 
    user_id TEXT NOT NULL, 
    joined_at TEXT DEFAULT (datetime('now')),
     left_at INTEGER DEFAULT NULL,

    PRIMARY KEY (server_id, user_id), 
    FOREIGN KEY (server_id) REFERENCES servers(server_id), 
    FOREIGN KEY (user_id) REFERENCES users(user_id) );


CREATE TABLE IF NOT EXISTS channel_members ( 
    channel_id TEXT NOT NULL, 
    user_id TEXT NOT NULL, 
    joined_at TEXT DEFAULT (datetime('now')),
     left_at INTEGER DEFAULT NULL,

    PRIMARY KEY (channel_id, user_id), 
    FOREIGN KEY (channel_id) REFERENCES channels(channel_id), 
    FOREIGN KEY (user_id) REFERENCES users(user_id) );


CREATE TABLE IF NOT EXISTS voice_activity ( 
    channel_id TEXT NOT NULL, 
    user_id TEXT NOT NULL, 
    is_muted BOOLEAN DEFAULT FALSE, 
    is_deafened BOOLEAN DEFAULT FALSE, 
    session_start_time TEXT DEFAULT (datetime('now')), 
    
    PRIMARY KEY (channel_id, user_id), 
    FOREIGN KEY (channel_id) REFERENCES channels(channel_id), 
    FOREIGN KEY (user_id) REFERENCES users(user_id) );


CREATE TABLE IF NOT EXISTS member_roles ( 
    user_id TEXT NOT NULL, 
    role_id TEXT NOT NULL, 
    server_id TEXT NOT NULL, 
    
    PRIMARY KEY (user_id, role_id, server_id), 
    FOREIGN KEY (user_id) REFERENCES users(user_id), 
    FOREIGN KEY (role_id) REFERENCES roles(role_id), 
    FOREIGN KEY (server_id) REFERENCES servers(server_id) );


CREATE TABLE IF NOT EXISTS friends ( 
    user_id TEXT NOT NULL, 
    friend_id TEXT NOT NULL, 
    status_id TEXT NOT NULL, 
    
    PRIMARY KEY (user_id, friend_id), 
    FOREIGN KEY (user_id) REFERENCES users(user_id), 
    FOREIGN KEY (friend_id) REFERENCES users(user_id), 
    FOREIGN KEY (status_id) REFERENCES friends_status(status_id) );


CREATE TABLE IF NOT EXISTS media_files ( 
    file_id TEXT PRIMARY KEY, 
    uploader_id TEXT NOT NULL, 
    file_path_r2 TEXT UNIQUE NOT NULL, 
    file_type TEXT, file_size_bytes INTEGER, 
    server_id TEXT, channel_id TEXT, 
    uploaded_at TEXT DEFAULT (datetime('now')),
    
     FOREIGN KEY (uploader_id) REFERENCES users(user_id), 
     FOREIGN KEY (server_id) REFERENCES servers(server_id), 
     FOREIGN KEY (channel_id) REFERENCES channels(channel_id) );


CREATE TABLE IF NOT EXISTS channel_messages ( 
    message_id TEXT PRIMARY KEY, 
    channel_id TEXT NOT NULL, 
    sender_id TEXT NOT NULL, 
    message_path_r2 TEXT UNIQUE NOT NULL, 
    media_file_id TEXT, 
    is_deleted BOOLEAN DEFAULT FALSE, 
    sent_at TEXT DEFAULT (datetime('now')), 
    
    FOREIGN KEY (channel_id) REFERENCES channels(channel_id), 
    FOREIGN KEY (sender_id) REFERENCES users(user_id), 
    FOREIGN KEY (media_file_id) REFERENCES media_files(file_id) );


CREATE TABLE IF NOT EXISTS system_logs ( 
    log_id TEXT PRIMARY KEY, 
    user_id TEXT, 
    category TEXT NOT NULL, 
    message TEXT NOT NULL, 
    created_at TEXT DEFAULT (datetime('now')), 
    
    FOREIGN KEY (user_id) REFERENCES users(user_id) );


CREATE TABLE IF NOT EXISTS user_notes ( 
    note_id TEXT PRIMARY KEY, 
    user_id TEXT NOT NULL, 
    title TEXT, 
    content_path_r2 TEXT UNIQUE NOT NULL, 
    created_at TEXT DEFAULT (datetime('now')), 

    FOREIGN KEY (user_id) REFERENCES users(user_id) );


CREATE TABLE IF NOT EXISTS dm_channels ( 
    dm_channel_id TEXT PRIMARY KEY, 
    user_id_1 TEXT NOT NULL, 
    user_id_2 TEXT NOT NULL, 
    created_at TEXT DEFAULT (datetime('now')), 
    UNIQUE (user_id_1, user_id_2), 

    FOREIGN KEY (user_id_1) REFERENCES users(user_id), 
    FOREIGN KEY (user_id_2) REFERENCES users(user_id) );


CREATE TABLE IF NOT EXISTS dm_messages ( 
    message_id TEXT PRIMARY KEY, 
    dm_channel_id TEXT NOT NULL, 
    sender_id TEXT NOT NULL, 
    message_path_r2 TEXT UNIQUE NOT NULL, 
    sent_at TEXT DEFAULT (datetime('now')), 
    
    FOREIGN KEY (dm_channel_id) REFERENCES dm_channels(dm_channel_id), 
    FOREIGN KEY (sender_id) REFERENCES users(user_id) );



CREATE TABLE IF NOT EXISTS group_channels ( 
    group_channel_id TEXT PRIMARY KEY, 
    creator_id TEXT NOT NULL, group_name TEXT, 
    created_at TEXT DEFAULT (datetime('now')), 
    
    FOREIGN KEY (creator_id) REFERENCES users(user_id) );


CREATE TABLE IF NOT EXISTS group_members ( 
    group_channel_id TEXT NOT NULL, 
    user_id TEXT NOT NULL, 
    joined_at TEXT DEFAULT (datetime('now')), 
    
    PRIMARY KEY (group_channel_id, user_id), 
    FOREIGN KEY (group_channel_id) REFERENCES group_channels(group_channel_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) );


CREATE TABLE IF NOT EXISTS group_messages ( 
    message_id TEXT PRIMARY KEY, 
    group_channel_id TEXT NOT NULL, 
    sender_id TEXT NOT NULL, 
    message_path_r2 TEXT UNIQUE NOT NULL, 
    sent_at TEXT DEFAULT (datetime('now')), 
    
    FOREIGN KEY (group_channel_id) REFERENCES group_channels(group_channel_id), 
    FOREIGN KEY (sender_id) REFERENCES users(user_id) );


-- #######################################################################
-- # 5. KONTROL VE SON KOMUTLAR (INSERT İŞLEMLERİ BURAYA GELECEK)
-- #######################################################################

INSERT INTO online_status (status_id, status_name) VALUES 
('STATUS_ONLINE', 'Çevrimiçi')
ON CONFLICT(status_id) DO NOTHING;

INSERT INTO online_status (status_id, status_name) VALUES 
('STATUS_OFFLINE', 'Çevrimdışı')
ON CONFLICT(status_id) DO NOTHING;

INSERT INTO online_status (status_id, status_name) VALUES 
('STATUS_IDLE', 'Boşta')
ON CONFLICT(status_id) DO NOTHING;

INSERT INTO online_status (status_id, status_name) VALUES 
('STATUS_DND', 'Rahatsız Etmeyin (DND)')
ON CONFLICT(status_id) DO NOTHING;


-- #######################################################################
-- # 2. CHANNELS_TYPES (Kanal Türleri)
-- #######################################################################
INSERT INTO channels_types (channel_type_id, channel_type_name) VALUES 
('TYPE_TEXT', 'Yazılı Kanal') 
ON CONFLICT(channel_type_id) DO NOTHING;

INSERT INTO channels_types (channel_type_id, channel_type_name) VALUES 
('TYPE_VOICE', 'Sesli/Video Kanalı') 
ON CONFLICT(channel_type_id) DO NOTHING;


-- #######################################################################
-- # 3. FRIENDS_STATUS (Arkadaşlık Durumları)
-- #######################################################################
INSERT INTO friends_status (status_id, status_name) VALUES 
('FRIEND_PENDING', 'Beklemede')
ON CONFLICT(status_id) DO NOTHING;

INSERT INTO friends_status (status_id, status_name) VALUES 
('FRIEND_ACCEPTED', 'Kabul Edildi')
ON CONFLICT(status_id) DO NOTHING;

INSERT INTO friends_status (status_id, status_name) VALUES 
('FRIEND_BLOCKED', 'Engellendi')
ON CONFLICT(status_id) DO NOTHING;


-- #######################################################################
-- # 4. REGIONS (Bölgeler / Cloudflare POP Noktaları)
-- #######################################################################
INSERT INTO regions (region_id, region_name) VALUES 
('REG_ANKARA', 'Ankara')
ON CONFLICT(region_id) DO NOTHING;

INSERT INTO regions (region_id, region_name) VALUES 
('REG_ISTANBUL', 'İstanbul')
ON CONFLICT(region_id) DO NOTHING;

INSERT INTO regions (region_id, region_name) VALUES 
('REG_BAHRAIN', 'Bahreyn')
ON CONFLICT(region_id) DO NOTHING;

INSERT INTO regions (region_id, region_name) VALUES 
('REG_FRANKFURT', 'Frankfurt')
ON CONFLICT(region_id) DO NOTHING;

INSERT INTO regions (region_id, region_name) VALUES 
('REG_SOFIA', 'Sofya')
ON CONFLICT(region_id) DO NOTHING;


PRAGMA foreign_keys = ON;