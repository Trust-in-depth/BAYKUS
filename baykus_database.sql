PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (   id TEXT PRIMARY KEY,                              username TEXT NOT NULL UNIQUE                        CHECK (username = lower(username))                 CHECK (username GLOB '[a-z0-9_-]*'),             name TEXT NOT NULL,                                avatar_url TEXT,                                   region TEXT,   anon INTEGER DEFAULT 0,   last_name_change_at INTEGER DEFAULT (strftime('%s','now')),    created_at INTEGER DEFAULT (strftime('%s','now')) , hashed_password TEXT NOT NULL DEFAULT 'NO_PASSWORD', email TEXT);
INSERT INTO "users" VALUES('b1c203e0-63e1-43c7-be82-d5927152c2de','emine_kurtay','Emine_Kurtay',NULL,NULL,0,1764123919,'2025-11-26T02:25:19.849Z','8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92','emine@gmail.com');
INSERT INTO "users" VALUES('6a520b3e-b5af-4db9-a642-cb114d7bafe9','tester01','Tester01',NULL,NULL,0,1764166470,'2025-11-26T14:14:30.224Z','8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92','test@baykus.com');
INSERT INTO "users" VALUES('f63cde59-b3f2-433b-942d-402189fcbe7d','ali̇','ALİ',NULL,NULL,0,1764180959,'2025-11-26T18:15:59.577Z','8bb0cf6eb9b17d0f7d22b456f121257dc1254e1f01665370476383ea776df414','ali@gmail.com');
INSERT INTO "users" VALUES('9cbd4bfa-de84-4f36-828e-d314706ceff0','emre','Emre',NULL,NULL,0,1764181083,'2025-11-26T18:18:03.157Z','8bb0cf6eb9b17d0f7d22b456f121257dc1254e1f01665370476383ea776df414','emre_mutlu@gmail.com');
INSERT INTO "users" VALUES('022893e3-f4fe-4d91-a59b-75f1f84bc164','fatma_yılmaz','Fatma_Yılmaz',NULL,NULL,0,1764181134,'2025-11-26T18:18:54.450Z','8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92','fatmanur@gmail.com');
INSERT INTO "users" VALUES('e5114ea0-9885-4200-8e14-31e40f6caa56','alice','Alice',NULL,NULL,0,1764196648,'2025-11-26T22:37:28.332Z','a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3','userA@baykus.com');
INSERT INTO "users" VALUES('dcf6787a-5cb1-4856-94c0-f78b5a7e176f','bob','Bob',NULL,NULL,0,1764196810,'2025-11-26T22:40:10.458Z','a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3','userB@baykus.com');
CREATE TABLE servers (   id TEXT PRIMARY KEY,                             owner_id TEXT NOT NULL,                          name TEXT NOT NULL,   icon_url TEXT,                                     created_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (owner_id) REFERENCES users(id) );
INSERT INTO "servers" VALUES('b3fd82b7-210f-40fe-9c0a-8c1861e8d6f5','e5114ea0-9885-4200-8e14-31e40f6caa56','Alice''in sunucusu',NULL,'2025-11-26T22:49:28.972Z');
INSERT INTO "servers" VALUES('91bca714-b064-40fc-882c-27f81c1c7c1e','b1c203e0-63e1-43c7-be82-d5927152c2de','Emine''nin sunucusu',NULL,'2025-11-27T02:00:03.008Z');
INSERT INTO "servers" VALUES('CHANNEL-0d73bd27-e11a-4d19-9c77-f8f37d557b26','e5114ea0-9885-4200-8e14-31e40f6caa56','Alice''in Sunucusu',NULL,'2025-11-30T22:08:36.726Z');
CREATE TABLE channels (   id TEXT PRIMARY KEY,                            server_id TEXT NOT NULL,                           type TEXT CHECK(type IN ('text', 'voice')) NOT NULL,   name TEXT NOT NULL,   topic TEXT,                                       order_index INTEGER DEFAULT 0,   created_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (server_id) REFERENCES servers(id),   UNIQUE (server_id, name)                         );
INSERT INTO "channels" VALUES('eb79fdc0-28a6-40c8-b82b-f400d60d95f1','b3fd82b7-210f-40fe-9c0a-8c1861e8d6f5','text','genel-sohbet','Sohbetin başladığı yer.',0,'2025-11-26T22:49:29.304Z');
INSERT INTO "channels" VALUES('fe4b28ce-b839-4e1f-bcf7-b32bd98aedcb','91bca714-b064-40fc-882c-27f81c1c7c1e','text','genel-sohbet','Sohbetin başladığı yer.',0,'2025-11-27T02:00:03.383Z');
INSERT INTO "channels" VALUES('0af5ff99-0925-4cc3-9b98-10cc7274808a','CHANNEL-0d73bd27-e11a-4d19-9c77-f8f37d557b26','text','genel-sohbet','Sohbetin başladığı yer.',0,'2025-11-30T22:08:36.806Z');
CREATE TABLE voice_activity (   id TEXT PRIMARY KEY,                               channel_id TEXT NOT NULL,                         user_id TEXT NOT NULL,                             joined_at INTEGER DEFAULT (strftime('%s','now')),   left_at INTEGER,                                   FOREIGN KEY (channel_id) REFERENCES channels(id),   FOREIGN KEY (user_id) REFERENCES users(id) );
CREATE TABLE server_members (   id TEXT PRIMARY KEY,                         server_id TEXT NOT NULL,                     user_id TEXT NOT NULL,                            role TEXT DEFAULT 'member',   joined_at INTEGER DEFAULT (strftime('%s','now')), left_at INTEGER,   FOREIGN KEY (server_id) REFERENCES servers(id),   FOREIGN KEY (user_id) REFERENCES users(id),   UNIQUE (server_id, user_id)                      );
INSERT INTO "server_members" VALUES('e861cddc-a6e8-4239-a599-358ccc4fe86d','b3fd82b7-210f-40fe-9c0a-8c1861e8d6f5','e5114ea0-9885-4200-8e14-31e40f6caa56','owner','2025-11-26T22:49:29.133Z',NULL);
INSERT INTO "server_members" VALUES('15ad1f96-8039-4d4e-baff-e0321c7a4d6f','b3fd82b7-210f-40fe-9c0a-8c1861e8d6f5','f63cde59-b3f2-433b-942d-402189fcbe7d','member','2025-11-28T09:46:32.059Z',NULL);
INSERT INTO "server_members" VALUES('9f574aa7-c40b-4b54-bfd4-9a5110aba81a','91bca714-b064-40fc-882c-27f81c1c7c1e','b1c203e0-63e1-43c7-be82-d5927152c2de','owner','2025-11-27T02:00:03.155Z',NULL);
INSERT INTO "server_members" VALUES('258965e7-41f0-46ca-9959-ed7e33bb2975','b3fd82b7-210f-40fe-9c0a-8c1861e8d6f5','b1c203e0-63e1-43c7-be82-d5927152c2de','member','2025-11-27T02:08:02.090Z',NULL);
INSERT INTO "server_members" VALUES('8662074e-0321-42aa-8e63-31e994b2e0f5','b3fd82b7-210f-40fe-9c0a-8c1861e8d6f5','022893e3-f4fe-4d91-a59b-75f1f84bc164','member','2025-11-27T02:19:39.824Z',NULL);
INSERT INTO "server_members" VALUES('44e6b3a0-091f-46b8-9bac-5cb210997ed4','91bca714-b064-40fc-882c-27f81c1c7c1e','022893e3-f4fe-4d91-a59b-75f1f84bc164','member','2025-11-27T02:20:02.928Z',NULL);
INSERT INTO "server_members" VALUES('9ecd624f-73d8-4eb1-ae2a-6a2061e67116','b3fd82b7-210f-40fe-9c0a-8c1861e8d6f5','9cbd4bfa-de84-4f36-828e-d314706ceff0','member','2025-11-27T02:27:32.858Z',NULL);
INSERT INTO "server_members" VALUES('cc07ac0a-e538-4648-9fa0-2d6a383a1c68','b3fd82b7-210f-40fe-9c0a-8c1861e8d6f5','6a520b3e-b5af-4db9-a642-cb114d7bafe9','member','2025-11-27T02:30:22.294Z',NULL);
INSERT INTO "server_members" VALUES('1ccb65b3-aafc-4b9a-8ca2-15834a6a8590','b3fd82b7-210f-40fe-9c0a-8c1861e8d6f5','dcf6787a-5cb1-4856-94c0-f78b5a7e176f','member','2025-11-29T15:40:44.740Z',1764430855);
INSERT INTO "server_members" VALUES('7a32d91a-3e14-4304-9fd6-bdf13e7946af','CHANNEL-0d73bd27-e11a-4d19-9c77-f8f37d557b26','e5114ea0-9885-4200-8e14-31e40f6caa56','owner','2025-11-30T22:08:36.767Z',NULL);


CREATE TABLE dm_channels (   id TEXT PRIMARY KEY,                             user1_id TEXT NOT NULL,                           user2_id TEXT NOT NULL,                            created_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (user1_id) REFERENCES users(id),   FOREIGN KEY (user2_id) REFERENCES users(id),   CHECK (user1_id < user2_id),   UNIQUE (user1_id, user2_id) );
INSERT INTO "dm_channels" VALUES('0403294a-e8d0-4932-9b63-122e15816b1e','dcf6787a-5cb1-4856-94c0-f78b5a7e176f','e5114ea0-9885-4200-8e14-31e40f6caa56','2025-11-29T19:02:33.638Z');
CREATE TABLE group_channels (   id TEXT PRIMARY KEY,                              owner_id TEXT NOT NULL,                            name TEXT NOT NULL,   created_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (owner_id) REFERENCES users(id) );
INSERT INTO "group_channels" VALUES('0858a428-b53f-434d-a252-e7a299ab3529','dcf6787a-5cb1-4856-94c0-f78b5a7e176f','Bob''un Grubu ',1764494561);
INSERT INTO "group_channels" VALUES('GROUP-e630f046-31f8-48c4-aa36-0c035ee61569','e5114ea0-9885-4200-8e14-31e40f6caa56','Baykuş Test Grubu: ALice,Emine,Tester,Emre',1764541356);
CREATE TABLE group_members (   id TEXT PRIMARY KEY,                              group_id TEXT NOT NULL,                           user_id TEXT NOT NULL,                             role TEXT DEFAULT 'member',   joined_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (group_id) REFERENCES group_channels(id),   FOREIGN KEY (user_id) REFERENCES users(id),   UNIQUE (group_id, user_id) );
INSERT INTO "group_members" VALUES('75253182-9db5-4439-ab87-94d6311bcbb8','0858a428-b53f-434d-a252-e7a299ab3529','dcf6787a-5cb1-4856-94c0-f78b5a7e176f','owner',1764494566);
INSERT INTO "group_members" VALUES('f50e07a5-09bc-4b69-a492-80d2ccd3c06a','0858a428-b53f-434d-a252-e7a299ab3529','9cbd4bfa-de84-4f36-828e-d314706ceff0','member',1764494566);
INSERT INTO "group_members" VALUES('0497b45c-76be-4707-b1d3-0abdd1c192c0','0858a428-b53f-434d-a252-e7a299ab3529','6a520b3e-b5af-4db9-a642-cb114d7bafe9','member',1764494566);
INSERT INTO "group_members" VALUES('0475981c-3526-44dd-bbf6-7d1ff8d7be8d','GROUP-e630f046-31f8-48c4-aa36-0c035ee61569','e5114ea0-9885-4200-8e14-31e40f6caa56','owner',1764541356);
INSERT INTO "group_members" VALUES('faf25d40-f115-45be-a5d9-21d4cea3c62b','GROUP-e630f046-31f8-48c4-aa36-0c035ee61569','6a520b3e-b5af-4db9-a642-cb114d7bafe9','member',1764541356);
INSERT INTO "group_members" VALUES('243032de-ebe1-4fcf-a0ea-0094b817dba9','GROUP-e630f046-31f8-48c4-aa36-0c035ee61569','9cbd4bfa-de84-4f36-828e-d314706ceff0','member',1764541356);
INSERT INTO "group_members" VALUES('443f3298-1d99-4178-87a1-aa19cf4b8a66','GROUP-e630f046-31f8-48c4-aa36-0c035ee61569','b1c203e0-63e1-43c7-be82-d5927152c2de','member',1764541356);
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'0001_add_tasks_table.sql','2025-11-03 12:26:14');
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NOT NULL,
    completed INTEGER NOT NULL,
    due_date DATETIME NOT NULL
);
CREATE TABLE friends ( 
    id TEXT PRIMARY KEY, 
    user_id TEXT NOT NULL, 
    friend_id TEXT NOT NULL, 
    -- rejected added to status check constraint
    status TEXT CHECK(status IN ('pending', 'accepted', 'blocked', 'rejected')) DEFAULT 'pending', 
    created_at INTEGER DEFAULT (strftime('%s','now')), 
    updated_at INTEGER DEFAULT (strftime('%s','now')), 
    FOREIGN KEY (user_id) REFERENCES users(id), 
    FOREIGN KEY (friend_id) REFERENCES users(id), 
    CHECK (user_id < friend_id), 
    UNIQUE (user_id, friend_id)
);
INSERT INTO "friends" VALUES('5f5a15c3-973a-4970-87e3-c7ce10f802bd','dcf6787a-5cb1-4856-94c0-f78b5a7e176f','e5114ea0-9885-4200-8e14-31e40f6caa56','accepted','2025-11-26T23:28:59.121Z','2025-11-27T00:09:51.796Z');
INSERT INTO "friends" VALUES('d01f8084-0719-4ef7-9066-117e236c4d70','dcf6787a-5cb1-4856-94c0-f78b5a7e176f','f63cde59-b3f2-433b-942d-402189fcbe7d','pending','2025-11-27T01:25:25.804Z',1764206725);
INSERT INTO "friends" VALUES('798c98e4-f0f9-4a65-bfdb-762c4de24066','9cbd4bfa-de84-4f36-828e-d314706ceff0','f63cde59-b3f2-433b-942d-402189fcbe7d','accepted','2025-11-27T01:26:12.636Z','2025-11-27T02:26:02.420Z');
INSERT INTO "friends" VALUES('c509579d-33a9-4c81-8049-8086089a2c86','022893e3-f4fe-4d91-a59b-75f1f84bc164','b1c203e0-63e1-43c7-be82-d5927152c2de','accepted','2025-11-27T02:03:13.542Z','2025-11-27T02:18:28.111Z');
INSERT INTO "friends" VALUES('7a6349ff-2572-4147-b140-971864a5c78f','b1c203e0-63e1-43c7-be82-d5927152c2de','dcf6787a-5cb1-4856-94c0-f78b5a7e176f','pending','2025-11-27T02:03:29.964Z',1764209010);
INSERT INTO "friends" VALUES('58c95f9d-217d-45bb-a1c0-4b1b5a4de479','6a520b3e-b5af-4db9-a642-cb114d7bafe9','b1c203e0-63e1-43c7-be82-d5927152c2de','accepted','2025-11-27T02:04:36.458Z','2025-11-27T02:31:25.606Z');
INSERT INTO "friends" VALUES('8b19590d-b05c-499b-bd6c-da5331b4d506','b1c203e0-63e1-43c7-be82-d5927152c2de','e5114ea0-9885-4200-8e14-31e40f6caa56','pending','2025-11-27T02:04:46.249Z',1764209086);
INSERT INTO "friends" VALUES('fbf9324c-cef1-4136-84a4-717609f14423','022893e3-f4fe-4d91-a59b-75f1f84bc164','f63cde59-b3f2-433b-942d-402189fcbe7d','blocked','2025-11-29T14:31:26.127Z','2025-11-29T14:31:51.977Z');
CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    name TEXT NOT NULL,         -- Rolün adı (Örn: Yardımcı, Aslan)
    permissions INTEGER NOT NULL, -- İzinlerin Bitmask değeri (Çıkarma, Yasaklama yetkileri)
    is_default BOOLEAN DEFAULT FALSE, -- Yeni üyelere otomatik atanır mı?
    FOREIGN KEY (server_id) REFERENCES servers(id),
    UNIQUE (server_id, name)
);
CREATE TABLE member_roles (
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    PRIMARY KEY (user_id, role_id, server_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (server_id) REFERENCES servers(id)
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',1);
