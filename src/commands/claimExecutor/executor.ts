import { BN } from "@polkadot/util";
import { Job, Processor } from "bullmq";

import { ClaimStatus } from "../../entities";
import { ClaimRepository } from "../../repositories/ClaimRepository";
import { logger } from "../../services/logger";
import { ClaimData } from "../../services/queue";
import { StatemintWallet } from "../../services/statemint";

export function executeClaim(
  wallet: StatemintWallet,
  claimRepository: ClaimRepository
): Processor<ClaimData> {
  return async (job: Job<ClaimData>): Promise<void> => {
    logger.info("Executing claim", {
      cliam: job.data,
    });

    try {
      await claimRepository.createClaim({
        status: ClaimStatus.SUCCESSFUL,
        claimTxHash: job.data.claimTxHash,
        saleContractId: job.data.saleContractId,
        amount: job.data.amount,
        receiver: job.data.receiver,
      });
      const tx = await wallet.transferFrom(
        job.data.saleContractId,
        job.data.walletAddress,
        job.data.receiver,
        new BN(job.data.amount)
      );

      logger.info(`Successfully executed claim`, {
        id: job.id,
        txHash: tx.hash,
        data: job.data,
      });
    } catch (error) {
      await claimRepository.createClaim({
        status: ClaimStatus.FAILED,
        claimTxHash: job.data.claimTxHash,
        saleContractId: job.data.saleContractId,
        amount: job.data.amount,
        receiver: job.data.receiver,
      });
      logger.error("Failed executing claim because of: ", {
        stack: error.stack,
        id: job.id,
        data: job.data,
      });
    }
  };
}
