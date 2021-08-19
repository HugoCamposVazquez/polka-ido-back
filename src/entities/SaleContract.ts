import { Column, Entity, ManyToOne, JoinColumn, PrimaryColumn } from "typeorm";

import { Block } from "./Block";

@Entity({ name: "saleContract" })
export class SaleContract {
  @PrimaryColumn()
  public id!: number;

  @Column("varchar")
  public address!: string;

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
