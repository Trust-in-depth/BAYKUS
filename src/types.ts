import { DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
export interface Env {

  BAYKUS_DB: D1Database;
  
  JWT_SECRET: string;

  LOG_FILES: R2Bucket;
  MEDIA_FILES: R2Bucket;
  MESSAGE_STORE: R2Bucket;
  USER_NOTES: R2Bucket;
  WHITEBOARD_DATA: R2Bucket;
  BAYKUS_FRONTEND_ASSETS: R2Bucket;


  ROOM: DurableObjectNamespace;
  USER_SESSION: DurableObjectNamespace;
  CHAT_ROOM: DurableObjectNamespace;
  NOTIFICATION: DurableObjectNamespace;
  PRIVATE_CHAT: DurableObjectNamespace;
  USER_METADATA: DurableObjectNamespace;
  USER_STATUS: DurableObjectNamespace;
  RATE_LIMIT: DurableObjectNamespace;
}


export type AppContext = Context<{ Bindings: Env }>;

export const Task = z.object({
	name: Str({ example: "lorem" }),
	slug: Str(),
	description: Str({ required: false }),
	completed: z.boolean().default(false),
	due_date: DateTime(),
});

