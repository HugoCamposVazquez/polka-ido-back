import envSchema from "env-schema";
import { Connection } from "typeorm";

import { blockIndexerConfig, Env } from "./config";
import { BlockRepository } from "./repositories/BlockRepository";
import { SaleContractRepository } from "./repositories/SaleContractRepository";
import { Indexer } from "./services/block-indexer";
import { getDatabaseConnection } from "./services/db";
import { logger } from "./services/logger";

main();

async function main(): Promise<void> {
  let indexer;
  try {
    const conf = envSchema<Env>(blockIndexerConfig);
    const db = await initDb();
    indexer = new Indexer(
      conf,
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

  process.on("unhandledRejection", (err) => {
    logger.error({ err }, "Unhandled promise rejection");
  });
}

async function initDb(): Promise<Connection> {
  const db = await getDatabaseConnection();
  await db.runMigrations({ transaction: "all" });
  return db;
}
