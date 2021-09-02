import EventEmitter from "events";

import Bull, { Queue } from "bull";
import envSchema from "env-schema";
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

  const mintQueue = new Bull(QueueType.CLAIM_EXECUTOR, {
    redis: {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
    },
  });
  const emiter = new EventEmitter();
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
  await blockIndexer.start(emiter);

  //do something when app is closing
  process.on("exit", async function () {
    await stop(blockIndexer, db, emiter, mintQueue);
  });

  //catches ctrl+c event
  process.on("SIGINT", async function () {
    await stop(blockIndexer, db, emiter, mintQueue);
  });

  // catches "kill pid" (for example: nodemon restart)
  process.on("SIGUSR1", async function () {
    await stop(blockIndexer, db, emiter, mintQueue);
  });

  process.on("SIGUSR2", async function () {
    await stop(blockIndexer, db, emiter, mintQueue);
  });

  //catches uncaught exceptions
  process.on("uncaughtException", async function () {
    await stop(blockIndexer, db, emiter, mintQueue);
  });
}

async function stop(
  blockIndexer?: BlockIndexer,
  db?: Connection,
  emiter?: EventEmitter,
  mintQueue?: Queue<QueueType>
): Promise<void> {
  try {
    await blockIndexer?.stop();
  } catch (e) {
    logger.error(`Error occurred during indexer stoppage: ${e.message}`);
  }

  emiter?.on("processingBlocksDone", async () => {
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
