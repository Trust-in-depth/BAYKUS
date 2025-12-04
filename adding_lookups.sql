-- #######################################################################
-- # 1. ONLINE_STATUS (Çevrimiçi Durumlar)
-- #######################################################################
-- user_details tablosu bu ID'ye varsayılan olarak referans verdiği için kritik
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
('REG_FRANKFURT', 'Frankfurt')
ON CONFLICT(region_id) DO NOTHING;

INSERT INTO regions (region_id, region_name) VALUES 
('REG_SOFIA', 'Sofya')
ON CONFLICT(region_id) DO NOTHING;

INSERT INTO regions (region_id, region_name) VALUES 
('REG_BAHRAIN', 'Bahreyn')
ON CONFLICT(region_id) DO NOTHING;