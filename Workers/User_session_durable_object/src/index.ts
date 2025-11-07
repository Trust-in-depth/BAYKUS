import { fromHono } from "chanfana";
import { Hono } from "hono";
import { TaskCreate } from "./endpoints/taskCreate";
import { TaskDelete } from "./endpoints/taskDelete";
import { TaskFetch } from "./endpoints/taskFetch";
import { TaskList } from "./endpoints/taskList";
export { UserSessionDurableObject } from "./UserSessionDurableObject";
import type { Env } from "./types";
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
export default app;

