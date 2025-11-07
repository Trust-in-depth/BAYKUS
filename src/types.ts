import { DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
export interface Env {
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

