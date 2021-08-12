import { FastifyInstance } from "fastify";

import * as blockController from "../controllers/BlockController";

export function registerRoutes(server: FastifyInstance): void {
  // auth endpoints
  server.get(
    blockController.getBlocks.url,
    blockController.getBlocks.opts,
    blockController.getBlocks.handler
  );
}
