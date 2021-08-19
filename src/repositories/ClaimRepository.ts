import { EntityRepository, Repository } from "typeorm";

import { Claim, ClaimStatus } from "../entities";

@EntityRepository(Claim)
export class ClaimRepository extends Repository<Claim> {
  public createClaim(claim: {
    receiver: string;
    amount: string;
    claimTxHash: string;
    saleContractId: number;
    status: ClaimStatus;
  }): Promise<Claim> {
    const createdClaim = this.create(claim);
    return this.save(createdClaim);
  }
}
