import { Column, Entity, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "block" })
export class Block {
  @PrimaryColumn()
  public blockHash!: string;

  @Column("varchar")
  public chainId!: number;

  @Column("varchar")
  public blockTime!: Date;

  @Column("varchar")
  public blockNumber!: number;

  @CreateDateColumn()
  public createdAt!: Date;
}
