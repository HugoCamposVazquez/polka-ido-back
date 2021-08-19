import { Worker } from "bullmq";
import { getConnection } from "typeorm";

import { ClaimRepository } from "../../repositories/ClaimRepository";
import { logger } from "../../services/logger";
import { QueueType } from "../../services/queue";
import { StatemintWallet } from "../../services/statemint";

import { executeClaim } from "./executor";

async function initClaimExecutor(): Promise<void> {
  const wallet = new StatemintWallet(process.env.STATEMINT_MNEMONIC as string);
  await wallet.initWallet(process.env.STATEMINT_URL as string);

  const db = getConnection();
  const claimRepository = db.getCustomRepository(ClaimRepository);

  new Worker(QueueType.CLAIM_EXECUTOR, executeClaim(wallet, claimRepository), {
    concurrency: 1,
    connection: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT as string),
    },
  });
}

initClaimExecutor()
  .then(() => {
    logger.info("Started worker for executing claims.");
  })
  .catch((error) => {
    logger.error("Failed starting worked for executing claims.", {
      reason: error,
    });
  });
