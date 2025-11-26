PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (   id TEXT PRIMARY KEY,                              username TEXT NOT NULL UNIQUE                        CHECK (username = lower(username))                 CHECK (username GLOB '[a-z0-9_-]*'),             name TEXT NOT NULL,                                avatar_url TEXT,                                   region TEXT,   anon INTEGER DEFAULT 0,   last_name_change_at INTEGER DEFAULT (strftime('%s','now')),    created_at INTEGER DEFAULT (strftime('%s','now')) , hashed_password TEXT NOT NULL DEFAULT 'NO_PASSWORD', email TEXT);
INSERT INTO "users" VALUES('b1c203e0-63e1-43c7-be82-d5927152c2de','emine_kurtay','Emine_Kurtay',NULL,NULL,0,1764123919,'2025-11-26T02:25:19.849Z','8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92','emine@gmail.com');
INSERT INTO "users" VALUES('6a520b3e-b5af-4db9-a642-cb114d7bafe9','tester01','Tester01',NULL,NULL,0,1764166470,'2025-11-26T14:14:30.224Z','8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92','test@baykus.com');
INSERT INTO "users" VALUES('f63cde59-b3f2-433b-942d-402189fcbe7d','ali̇','ALİ',NULL,NULL,0,1764180959,'2025-11-26T18:15:59.577Z','8bb0cf6eb9b17d0f7d22b456f121257dc1254e1f01665370476383ea776df414','ali@gmail.com');
INSERT INTO "users" VALUES('9cbd4bfa-de84-4f36-828e-d314706ceff0','emre','Emre',NULL,NULL,0,1764181083,'2025-11-26T18:18:03.157Z','8bb0cf6eb9b17d0f7d22b456f121257dc1254e1f01665370476383ea776df414','emre_mutlu@gmail.com');
INSERT INTO "users" VALUES('022893e3-f4fe-4d91-a59b-75f1f84bc164','fatma_yılmaz','Fatma_Yılmaz',NULL,NULL,0,1764181134,'2025-11-26T18:18:54.450Z','8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92','fatmanur@gmail.com');
INSERT INTO "users" VALUES('389c105b-0c2d-4e3b-9482-a7d6e0e582e9','alphauser','alphauser',NULL,NULL,0,1764182625,'2025-11-26T18:43:45.051Z','a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3','userA@test.com');
INSERT INTO "users" VALUES('26408ccc-aa5b-43b3-9181-89151c3c8e72','betauser','betauser',NULL,NULL,0,1764182641,'2025-11-26T18:44:01.882Z','a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3','userB@test.com');
CREATE TABLE servers (   id TEXT PRIMARY KEY,                             owner_id TEXT NOT NULL,                          name TEXT NOT NULL,   icon_url TEXT,                                     created_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (owner_id) REFERENCES users(id) );
INSERT INTO "servers" VALUES('4db5df40-1917-4488-b823-3215bba727f5','b1c203e0-63e1-43c7-be82-d5927152c2de','Postman Test Sunucusu',NULL,'2025-11-26T02:28:47.019Z');
INSERT INTO "servers" VALUES('924db6a3-8e6a-430f-b5ad-fec736fe4bef','389c105b-0c2d-4e3b-9482-a7d6e0e582e9','Canlı Test Sunucusu',NULL,'2025-11-26T19:37:34.718Z');
INSERT INTO "servers" VALUES('bfe92257-0e48-47d9-bc29-3e4c223374a0','389c105b-0c2d-4e3b-9482-a7d6e0e582e9','Canlı Test Sunucusu',NULL,'2025-11-26T19:37:57.949Z');
CREATE TABLE channels (   id TEXT PRIMARY KEY,                            server_id TEXT NOT NULL,                           type TEXT CHECK(type IN ('text', 'voice')) NOT NULL,   name TEXT NOT NULL,   topic TEXT,                                       order_index INTEGER DEFAULT 0,   created_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (server_id) REFERENCES servers(id),   UNIQUE (server_id, name)                         );
INSERT INTO "channels" VALUES('b6ed72f7-92b7-4eab-aefd-1cd91a9a3f45','4db5df40-1917-4488-b823-3215bba727f5','text','genel-sohbet','Sohbetin başladığı yer.',0,'2025-11-26T02:28:49.015Z');
INSERT INTO "channels" VALUES('43252e4b-661c-4acc-8e1b-5e78e5aeeb30','924db6a3-8e6a-430f-b5ad-fec736fe4bef','text','genel-sohbet','Sohbetin başladığı yer.',0,'2025-11-26T19:37:35.790Z');
INSERT INTO "channels" VALUES('3a5f7218-33c4-41e7-beef-db9ee8a80e77','bfe92257-0e48-47d9-bc29-3e4c223374a0','text','genel-sohbet','Sohbetin başladığı yer.',0,'2025-11-26T19:37:58.221Z');
CREATE TABLE voice_activity (   id TEXT PRIMARY KEY,                               channel_id TEXT NOT NULL,                         user_id TEXT NOT NULL,                             joined_at INTEGER DEFAULT (strftime('%s','now')),   left_at INTEGER,                                   FOREIGN KEY (channel_id) REFERENCES channels(id),   FOREIGN KEY (user_id) REFERENCES users(id) );
CREATE TABLE server_members (   id TEXT PRIMARY KEY,                         server_id TEXT NOT NULL,                     user_id TEXT NOT NULL,                            role TEXT DEFAULT 'member',   joined_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (server_id) REFERENCES servers(id),   FOREIGN KEY (user_id) REFERENCES users(id),   UNIQUE (server_id, user_id)                      );
INSERT INTO "server_members" VALUES('6023cb4d-d7f7-44f5-a5f3-ae5964ea21dd','4db5df40-1917-4488-b823-3215bba727f5','b1c203e0-63e1-43c7-be82-d5927152c2de','owner','2025-11-26T02:28:48.862Z');
INSERT INTO "server_members" VALUES('e325aaa9-c864-4de1-af90-8ab3c4e261e5','924db6a3-8e6a-430f-b5ad-fec736fe4bef','389c105b-0c2d-4e3b-9482-a7d6e0e582e9','owner','2025-11-26T19:37:35.636Z');
INSERT INTO "server_members" VALUES('d3bebb4c-9f8b-442a-9fd0-23a8be980593','bfe92257-0e48-47d9-bc29-3e4c223374a0','389c105b-0c2d-4e3b-9482-a7d6e0e582e9','owner','2025-11-26T19:37:58.095Z');
CREATE TABLE dm_channels (   id TEXT PRIMARY KEY,                             user1_id TEXT NOT NULL,                           user2_id TEXT NOT NULL,                            created_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (user1_id) REFERENCES users(id),   FOREIGN KEY (user2_id) REFERENCES users(id),   CHECK (user1_id < user2_id),   UNIQUE (user1_id, user2_id) );
CREATE TABLE group_channels (   id TEXT PRIMARY KEY,                              owner_id TEXT NOT NULL,                            name TEXT NOT NULL,   created_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (owner_id) REFERENCES users(id) );
CREATE TABLE group_members (   id TEXT PRIMARY KEY,                              group_id TEXT NOT NULL,                           user_id TEXT NOT NULL,                             role TEXT DEFAULT 'member',   joined_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (group_id) REFERENCES group_channels(id),   FOREIGN KEY (user_id) REFERENCES users(id),   UNIQUE (group_id, user_id) );
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
INSERT INTO "friends" VALUES('75bd1403-1528-4ae7-90d3-38e91a97ff2b','26408ccc-aa5b-43b3-9181-89151c3c8e72','389c105b-0c2d-4e3b-9482-a7d6e0e582e9','pending','2025-11-26T20:15:54.146Z',1764188154);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',1);
