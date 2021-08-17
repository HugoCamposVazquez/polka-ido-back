import fastify from "fastify";
import fastifyEnv from "fastify-env";
import { Connection } from "typeorm";

import { config as envPluginConfig } from "./config";
import { BlockRepository } from "./repositories/BlockRepository";
import { SaleContractRepository } from "./repositories/SaleContractRepository";
import { Indexer } from "./services/block-indexer";
import { getDatabaseConnection } from "./services/db";
import { logger } from "./services/logger";

main();

async function main(): Promise<void> {
  let indexer;
  try {
    const db = await initDb();
    const instance = fastify({
      logger: logger,
      return503OnClosing: true,
    });
    instance.register(fastifyEnv, envPluginConfig);
    await instance.ready();
    indexer = new Indexer(
      instance.config,
      db.getCustomRepository(BlockRepository),
      db.getCustomRepository(SaleContractRepository)
    );

    indexer.start();
  } catch (error) {
    logger.error(
      `Error occurred during app startup because of: ${error.stack}`
    );
    await indexer?.stop();
  }
}

async function initDb(): Promise<Connection> {
  const db = await getDatabaseConnection();
  await db.runMigrations({ transaction: "all" });
  return db;
}
