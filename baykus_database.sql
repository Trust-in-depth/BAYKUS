PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (   id TEXT PRIMARY KEY,                              username TEXT NOT NULL UNIQUE                        CHECK (username = lower(username))                 CHECK (username GLOB '[a-z0-9_-]*'),             name TEXT NOT NULL,                                avatar_url TEXT,                                   region TEXT,   anon INTEGER DEFAULT 0,   last_name_change_at INTEGER DEFAULT (strftime('%s','now')),    created_at INTEGER DEFAULT (strftime('%s','now')) , hashed_password TEXT NOT NULL DEFAULT 'NO_PASSWORD', email TEXT);
CREATE TABLE servers (   id TEXT PRIMARY KEY,                             owner_id TEXT NOT NULL,                          name TEXT NOT NULL,   icon_url TEXT,                                     created_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (owner_id) REFERENCES users(id) );
CREATE TABLE channels (   id TEXT PRIMARY KEY,                            server_id TEXT NOT NULL,                           type TEXT CHECK(type IN ('text', 'voice')) NOT NULL,   name TEXT NOT NULL,   topic TEXT,                                       order_index INTEGER DEFAULT 0,   created_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (server_id) REFERENCES servers(id),   UNIQUE (server_id, name)                         );
CREATE TABLE voice_activity (   id TEXT PRIMARY KEY,                               channel_id TEXT NOT NULL,                         user_id TEXT NOT NULL,                             joined_at INTEGER DEFAULT (strftime('%s','now')),   left_at INTEGER,                                   FOREIGN KEY (channel_id) REFERENCES channels(id),   FOREIGN KEY (user_id) REFERENCES users(id) );
CREATE TABLE server_members (   id TEXT PRIMARY KEY,                         server_id TEXT NOT NULL,                     user_id TEXT NOT NULL,                            role TEXT DEFAULT 'member',   joined_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (server_id) REFERENCES servers(id),   FOREIGN KEY (user_id) REFERENCES users(id),   UNIQUE (server_id, user_id)                      );
CREATE TABLE friends (   id TEXT PRIMARY KEY,                            user_id TEXT NOT NULL,                            friend_id TEXT NOT NULL,                        status TEXT CHECK(status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',   created_at INTEGER DEFAULT (strftime('%s','now')),   updated_at INTEGER DEFAULT (strftime('%s','now')),   FOREIGN KEY (user_id) REFERENCES users(id),   FOREIGN KEY (friend_id) REFERENCES users(id),   CHECK (user_id < friend_id),                      UNIQUE (user_id, friend_id) );
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
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',1);
