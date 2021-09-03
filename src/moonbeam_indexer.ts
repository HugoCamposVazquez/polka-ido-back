import { Queue } from "bullmq";
import envSchema from "env-schema";
import nodeCleanup from "node-cleanup";
import { Connection } from "typeorm";

import { blockIndexerConfig, Env } from "./config";
import { BlockRepository } from "./repositories/BlockRepository";
import { SaleContractRepository } from "./repositories/SaleContractRepository";
import { BlockIndexer } from "./services/block-indexer";
import { getDatabaseConnection } from "./services/db";
import { logger } from "./services/logger";
import { QueueType } from "./services/queue";

async function main(): Promise<void> {
  const config = envSchema<Env>(blockIndexerConfig);
  const db = await getDatabaseConnection();
  await db.runMigrations({ transaction: "all" });

  const mintQueue = new Queue(QueueType.CLAIM_EXECUTOR, {
    connection: {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
    },
  });
  const salecontractRepo = db.getCustomRepository(SaleContractRepository);
  // get saleContract addresses
  const saleContractAddresses = await salecontractRepo.getAllAddresses();

  const blockIndexer = new BlockIndexer(
    config,
    db.getCustomRepository(BlockRepository),
    saleContractAddresses,
    salecontractRepo,
    mintQueue
  );
  // process all unhandled blocks
  await blockIndexer.start();

  nodeCleanup(function () {
    stop(blockIndexer, db, mintQueue);
    nodeCleanup.uninstall();
    return false;
  });
}

async function stop(
  blockIndexer?: BlockIndexer,
  db?: Connection,
  mintQueue?: Queue<QueueType>
): Promise<void> {
  try {
    await blockIndexer?.stop();
  } catch (e) {
    logger.error(`Error occurred during indexer stoppage: ${e.message}`);
  }

  blockIndexer?.emiter.on("processingBlocksDone", async () => {
    try {
      await db?.close();
    } catch (error) {
      logger.error(
        `Error occurred during database closing because: ${error.message}`
      );
    }
    try {
      await mintQueue?.close();
    } catch (error) {
      logger.error(
        `Error occurred during redis closing because: ${error.message}`
      );
    }
  });
}

main().then(() => {
  logger.info("Block indexer started");
});
