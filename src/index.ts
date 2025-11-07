import { fromHono } from "chanfana";
import { Hono } from "hono";
import { TaskCreate } from "./endpoints/taskCreate";
import { TaskDelete } from "./endpoints/taskDelete";
import { TaskFetch } from "./endpoints/taskFetch";
import { TaskList } from "./endpoints/taskList";
export { Room } from "./room";
import type { Env } from "./types";
//DO"ları import et
import { UserSessionDurableObject } from "./User_session_durable_object";
import { ChatRoomDurableObject } from "./Chat_room_durable_object";
import { NotificationDurableObject } from "./Notification_durable_object";
import { PrivateChatDurableObject } from "./Private_chat_durable_object";
import { UserMetadataDurableObject } from "./User_metadata_durable_object";
import { UserStatusDurableObject } from "./User_status_durable_object";
import { RateLimitDurableObject } from "./Rate_limit_durable_object";
//deneme oto deploy çalışıyor mu diye?
// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/tasks", TaskList);
openapi.post("/api/tasks", TaskCreate);
openapi.get("/api/tasks/:taskSlug", TaskFetch);
openapi.delete("/api/tasks/:taskSlug", TaskDelete);

//./User_session_durable_object API route örneği
app.post("/chat/send", async (c) => {
  const body = await c.req.json();
  const id = c.env.CHAT_ROOM.idFromName(body.roomId);
  const stub = c.env.CHAT_ROOM.get(id);
  await stub.fetch("https://dummy/send-message", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return c.text("Message sent");
});

app.get("/chat/messages/:roomId", async (c) => {
  const id = c.env.CHAT_ROOM.idFromName(c.req.param("roomId"));
  const stub = c.env.CHAT_ROOM.get(id);
  const res = await stub.fetch("https://dummy/get-messages");
  const data = await res.json();
  return c.json(data);
});

//Notigication DO route örneği
app.post("/notify/track", async (c) => {
  const id = c.env.NOTIFICATION.idFromName("global");
  const stub = c.env.NOTIFICATION.get(id);
  await stub.fetch("https://dummy/track", { method: "POST" });
  return c.text("Tracked");
});

app.get("/notify/count", async (c) => {
  const id = c.env.NOTIFICATION.idFromName("global");
  const stub = c.env.NOTIFICATION.get(id);
  const res = await stub.fetch("https://dummy/get-count");
  const data = await res.json();
  return c.json(data);
});

//Private Chat DO route örneği
app.post("/dm/send", async (c) => {
  const body = await c.req.json();
  const id = c.env.PRIVATE_CHAT.idFromName(body.chatId);
  const stub = c.env.PRIVATE_CHAT.get(id);
  await stub.fetch("https://dummy/send-dm", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return c.text("DM sent");
});

app.get("/dm/history/:chatId", async (c) => {
  const id = c.env.PRIVATE_CHAT.idFromName(c.req.param("chatId"));
  const stub = c.env.PRIVATE_CHAT.get(id);
  const res = await stub.fetch("https://dummy/get-dm-history");
  const data = await res.json();
  return c.json(data);
});

//Metadata DO route örneği
app.post("/user/metadata", async (c) => {
  const body = await c.req.json();
  const id = c.env.USER_METADATA.idFromName(body.userId);
  const stub = c.env.USER_METADATA.get(id);
  await stub.fetch("https://dummy/update-metadata", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return c.text("Metadata updated");
});

app.get("/user/metadata/:userId", async (c) => {
  const id = c.env.USER_METADATA.idFromName(c.req.param("userId"));
  const stub = c.env.USER_METADATA.get(id);
  const res = await stub.fetch("https://dummy/get-metadata");
  const data = await res.json();
  return c.json(data);
});

//User Status DO route örneği
app.post("/user/status", async (c) => {
  const body = await c.req.json();
  const id = c.env.USER_STATUS.idFromName(body.userId);
  const stub = c.env.USER_STATUS.get(id);
  await stub.fetch("https://dummy/set-status", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return c.text("Status updated");
});

app.get("/user/status/:userId", async (c) => {
  const id = c.env.USER_STATUS.idFromName(c.req.param("userId"));
  const stub = c.env.USER_STATUS.get(id);
  const res = await stub.fetch("https://dummy/get-status");
  const data = await res.json();
  return c.json(data);
});

//Rate Limit DO route örneği
app.get("/rate/check", async (c) => {
  const id = c.env.RATE_LIMIT.idFromName("global");
  const stub = c.env.RATE_LIMIT.get(id);
  const res = await stub.fetch("https://dummy/");
  const text = await res.text();
  return c.text(text);
});
//app.get("/room/:id", async (c) => {
 // const roomId = c.req.param("id");
 // const id = c.env.ROOM.idFromName(roomId);
 // const obj = c.env.ROOM.get(id);
 // const response = await obj.fetch(c.req.raw);
//  return response;
//});

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app
export { UserSessionDurableObject };
export default app;

