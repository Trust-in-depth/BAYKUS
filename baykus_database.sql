-- Baykus Database Schema
-- TABLO 1: users (Kullanıcı temel bilgileri ve kimlik doğrulama)
--------------------------------------------------------------------------------
-- Amaç: Platformdaki tüm kullanıcıları ve kimlik doğrulama bilgilerini saklar.
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- Benzersiz kullanıcı kimliği
    email TEXT UNIQUE NOT NULL, -- Giriş için benzersiz e-posta
    hashed_password TEXT NOT NULL, -- Güvenlik için şifrenin hash'lenmiş hali
    username TEXT, -- Kullanıcı adı (görünen ad)
    name TEXT,
    avatar_url TEXT,
    region TEXT,
    anon INTEGER DEFAULT 0, -- Anonim kullanıcı durumu (0=hayır, 1=evet)
    last_name_change_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLO 2: servers (Discord'daki 'Sunucu' yapısı)
--------------------------------------------------------------------------------
-- Amaç: Kullanıcıların oluşturduğu toplulukları veya büyük grupları temsil eder.
CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL, -- Sunucuyu oluşturan kullanıcı
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    icon_url TEXT,
    FOREIGN KEY (owner_id) REFERENCES users(id) -- owner_id'yi users tablosuna bağlar
);

-- TABLO 3: channels (Sunucudaki Metin/Sesli Kanallar)
--------------------------------------------------------------------------------
-- Görüntüdeki sütunlara uyarlanmıştır.
-- Amaç: Belirli bir sunucuya ait metin veya sesli kanalları saklar.
CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY, -- Kanal kimliği
    server_id TEXT NOT NULL, -- Kanalın ait olduğu sunucu
    type TEXT NOT NULL, -- 'text' (metin) veya 'voice' (sesli)
    name TEXT NOT NULL,
    topic TEXT, -- Kanal konusu
    order_index INTEGER, -- Kanalların listedeki sıralaması
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id)
);

-- TABLO 4: friends (Arkadaşlık İlişkileri)
--------------------------------------------------------------------------------
-- Görüntüdeki yapıya göre, ilişkiyi tekil bir ID ile yönetir.
-- Amaç: Kullanıcılar arası arkadaşlık isteklerini (beklemede) ve kabul edilmiş arkadaşlıkları kaydeder.
CREATE TABLE IF NOT EXISTS friends (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- İstek gönderen veya ilişkiyi başlatan
    friend_id TEXT NOT NULL, -- İstek alan veya diğer taraf
    status TEXT NOT NULL, -- 'pending' (beklemede), 'accepted', 'blocked'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
);

-- TABLO 5: group_members (Grup Sohbeti Üyeleri)
--------------------------------------------------------------------------------
-- Amaç: Çevrim içi grup sohbetlerine kimlerin katıldığını tutar.
CREATE TABLE IF NOT EXISTS group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL, -- Hangi grup sohbeti (group_channels tablosuna bağlı)
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', 
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES group_channels(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- TABLO 6: server_members (Sunucu Üyeliği ve Rol Yönetimi)
--------------------------------------------------------------------------------
-- Görüntüdeki yapıya göre, her üyelik için tekil bir ID kullanılır.
-- Amaç: Hangi kullanıcının hangi sunucuya üye olduğunu ve hangi rolde olduğunu tutar.
CREATE TABLE IF NOT EXISTS server_members (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member', -- Üye, yönetici, sahip rolleri
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- TABLO 7: tasks (Ek Özellikler/Görevler)
--------------------------------------------------------------------------------
-- Görüntüdeki yapıya göre tasarlanmıştır. (İsteğe bağlı olarak kullanıcı görevlerini tutar.)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT, -- Görevin atandığı veya oluşturulduğu kullanıcı (Görüntüde yoktu, mantık için eklendi)
    name TEXT NOT NULL,
    slug TEXT,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    due_date TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- TABLO 8: voice_activity (Sesli Kanal Oturum Geçmişi)
--------------------------------------------------------------------------------
-- Görüntüdeki yapıya göre (joined_at ve left_at sütunları) sesli oturumların kaydını tutar.
-- Amaç: Bir kullanıcının sesli kanala ne zaman katılıp ne zaman ayrıldığını kaydeder (geçmiş izleme).
CREATE TABLE IF NOT EXISTS voice_activity (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP, -- Ayrılma zamanı (NULL ise hala kanalda demektir)
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (channel_id) REFERENCES channels(id)
);

-- TABLO 9: dm_channels (Doğrudan Mesajlaşma Kanalları)
--------------------------------------------------------------------------------
-- Amaç: İki kullanıcı arasında açılan birebir sohbet kanallarını tanımlar.
CREATE TABLE IF NOT EXISTS dm_channels (
    id TEXT PRIMARY KEY,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id)
);

-- TABLO 10: group_channels (Çoklu Katılımcılı Grup Sohbetleri)
--------------------------------------------------------------------------------
-- Amaç: Üç veya daha fazla kişinin katıldığı özel grup sohbetlerini tanımlar.
CREATE TABLE IF NOT EXISTS group_channels (
    id TEXT PRIMARY KEY,
    name TEXT, -- Grubun adı (isteğe bağlı)
    owner_id TEXT, -- Grubu oluşturan kişi
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);