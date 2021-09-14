import { Column, Entity, ManyToOne, JoinColumn, PrimaryColumn } from "typeorm";

import { Block } from "./Block";

@Entity({ name: "saleContract" })
export class SaleContract {
  @PrimaryColumn("varchar")
  public id!: string;

  @Column("integer")
  public chainId!: number;

  @Column("varchar")
  public blockHash!: string;

  @Column("varchar")
  public walletAddress!: string;

  @ManyToOne(() => Block, (block) => block.blockHash)
  @JoinColumn({
    name: "blockHash",
  })
  block!: Block;
}
