import { createServer, startServer } from "./transport/http/server.js";

const port = parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

const app = await createServer();
await startServer(app, port, host);