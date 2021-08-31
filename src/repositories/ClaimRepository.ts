import { EntityRepository, InsertResult, Repository } from "typeorm";

import { Claim, ClaimStatus } from "../entities";

@EntityRepository(Claim)
export class ClaimRepository extends Repository<Claim> {
  public createClaim(claim: {
    receiver: string;
    amount: string;
    claimTxHash: string;
    saleContractId: number;
    status: ClaimStatus;
  }): Promise<InsertResult> {
    const createdClaim = this.create(claim);
    return this.insert(createdClaim);
  }

  public async updateClaimStatus(
    claimId: string,
    status: ClaimStatus
  ): Promise<void> {
    await this.update(
      {
        claimTxHash: claimId,
      },
      {
        status: status,
      }
    );
  }
}
