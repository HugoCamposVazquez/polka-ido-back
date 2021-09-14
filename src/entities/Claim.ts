import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { SaleContract } from "./SaleContract";

export enum ClaimStatus {
  SUCCESSFUL = "successful",
  FAILED = "failed",
}

@Entity({ name: "claims" })
export class Claim {
  @PrimaryColumn()
  public claimTxHash!: string;

  @Column("varchar")
  public receiver!: string;

  @Column("varchar")
  public amount!: string;

  @Column({
    type: "varchar",
  })
  public status!: ClaimStatus;

  @ManyToOne(() => SaleContract, (contract) => contract.id, {
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "saleContractId",
  })
  public saleContract!: SaleContract;

  @Column()
  public saleContractId!: string;
}
