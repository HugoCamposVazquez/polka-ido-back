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
    logger.info(
      {
        claim: job.data,
      },
      "Executing claim"
    );

    try {
      await claimRepository.createClaim({
        status: ClaimStatus.SUCCESSFUL,
        claimTxHash: job.data.claimTxHash,
        saleContractId: job.data.saleContractId,
        amount: job.data.amount,
        receiver: job.data.receiver,
      });

      logger.info(
        {
          id: job.id,
          data: job.data,
        },
        `Successfully created claim`
      );
    } catch (error) {
      logger.error(
        {
          stack: error.stack,
          id: job.id,
          data: job.data,
        },
        "Failed inserting claim"
      );

      return;
    }

    try {
      await wallet.transferFrom(
        job.data.tokenId,
        job.data.walletAddress,
        job.data.receiver,
        new BN(job.data.amount),
        job.data.claimTxHash
      );

      logger.info(
        {
          id: job.id,
          data: job.data,
        },
        `Successfully transfered claim`
      );
    } catch (error) {
      await claimRepository.updateClaimStatus(
        job.data.claimTxHash,
        ClaimStatus.FAILED
      );
      logger.error(
        {
          stack: error.stack,
          id: job.id,
          data: job.data,
        },
        "Failed tranfering claim"
      );
    }
  };
}
