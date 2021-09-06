import { Worker } from "bullmq";
import nodeCleanup from "node-cleanup";
import { Connection } from "typeorm";

import { executeClaim } from "./commands/claimExecutor";
import { ClaimRepository } from "./repositories/ClaimRepository";
import { getDatabaseConnection } from "./services/db";
import { logger } from "./services/logger";
import { QueueType } from "./services/queue";
import { StatemintWallet } from "./services/statemint";

async function initClaimExecutor(): Promise<void> {
  const wallet = new StatemintWallet(process.env.STATEMINT_MNEMONIC as string);
  await wallet.initWallet(process.env.STATEMINT_URL as string);

  const db = await getDatabaseConnection();
  const claimRepository = db.getCustomRepository(ClaimRepository);

  const worker = new Worker(
    QueueType.CLAIM_EXECUTOR,
    executeClaim(wallet, claimRepository),
    {
      concurrency: 1,
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT as string),
      },
    }
  );

  nodeCleanup(function () {
    stop(db, worker);
    nodeCleanup.uninstall();
    return false;
  });
}

async function stop(db?: Connection, worker?: Worker): Promise<void> {
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
    logger.error(
      {
        reason: error.stack,
      },
      "Failed starting worker for executing claims."
    );
  });
