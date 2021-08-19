import { BN } from "@polkadot/util";
import { Job, Processor } from "bullmq";

import { Claim, ClaimStatus } from "../../entities";
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

    let claim: Claim;
    try {
      claim = await claimRepository.createClaim({
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
      await claimRepository.createClaim({
        status: ClaimStatus.FAILED,
        claimTxHash: job.data.claimTxHash,
        saleContractId: job.data.saleContractId,
        amount: job.data.amount,
        receiver: job.data.receiver,
      });
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
      const tx = await wallet.transferFrom(
        job.data.saleContractId,
        job.data.walletAddress,
        job.data.receiver,
        new BN(job.data.amount)
      );

      logger.info(
        {
          id: job.id,
          txHash: tx.hash,
          data: job.data,
        },
        `Successfully transfered claim`
      );
    } catch (error) {
      await claimRepository.updateClaimStatus(
        claim.claimTxHash,
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
