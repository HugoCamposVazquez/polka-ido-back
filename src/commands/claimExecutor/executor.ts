import { BN } from "@polkadot/util";
import { Job, Processor } from "bullmq";

import { logger } from "../../services/logger";
import { StatemintWallet } from "../../services/statemint";

export interface ClaimData {
  tokenId: number;
  owner: string;
  receiver: string;
  amount: string;
}

export function executeClaim(wallet: StatemintWallet): Processor<ClaimData> {
  return async (job: Job<ClaimData>): Promise<void> => {
    logger.info("Executing job: ", job.id);

    try {
      const result = await wallet.transferFrom(
        job.data.tokenId,
        job.data.owner,
        job.data.receiver,
        new BN(job.data.amount)
      );

      logger.info(`Successfully executed claim`, {
        id: job.id,
        txHash: result.hash,
        data: job.data,
      });
    } catch (error) {
      logger.error("Failed executing claim because of: ", {
        stack: error.stack,
        id: job.id,
        data: job.data,
      });
    }
  };
}
