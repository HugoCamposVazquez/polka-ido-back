import { Worker } from "bullmq";
import { Connection, getConnection } from "typeorm";

import { executeClaim } from "./commands/claimExecutor";
import { ClaimRepository } from "./repositories/ClaimRepository";
import { logger } from "./services/logger";
import { QueueType } from "./services/queue";
import { StatemintWallet } from "./services/statemint";

async function initClaimExecutor(): Promise<void> {
  const wallet = new StatemintWallet(process.env.STATEMINT_MNEMONIC as string);
  await wallet.initWallet(process.env.STATEMINT_URL as string);

  const db = getConnection();
  const claimRepository = db.getCustomRepository(ClaimRepository);

  const worker = new Worker(QueueType.CLAIM_EXECUTOR, executeClaim(wallet, claimRepository), {
    concurrency: 1,
    connection: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT as string),
    },
  });
  
    //catches ctrl+c event
    process.on("SIGINT", async () => {
      await stop(db, worker);
    });

    process.on('SIGTERM', async () => {
      await stop(db, worker);
    })
  
    // catches "kill pid" (for example: nodemon restart)
    process.on("SIGUSR1", async () => {
      await stop(db, worker);
    });
  
    //catches uncaught exceptions
    process.on("uncaughtException", async () => {
      await stop(db, worker);
    });
}

async function stop(db?: Connection, worker?: Worker) {
    try {
        await db?.close();
    } catch (error) {
        logger.error(
        `Error occurred during database closing because: ${error.message}`
        );
    }
    try {
        await worker?.close();
    } catch (error) {
        logger.error(
        `Error occurred during redis closing because: ${error.message}`
        );
    }
}

initClaimExecutor()
  .then(() => {
    logger.info("Started worker for executing claims.");
  })
  .catch((error) => {
    logger.error("Failed starting worker for executing claims.", {
      reason: error,
    });
  });

