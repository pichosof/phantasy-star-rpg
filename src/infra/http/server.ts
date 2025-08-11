import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "../config/env.js";
import { playerRoutes } from "./routes/player.routes.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.CORS_ORIGIN || "*" });

  app.get("/api/health", async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(playerRoutes);

  return app;
}
