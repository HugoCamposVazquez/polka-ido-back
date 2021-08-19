import { Column, Entity, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "block" })
export class Block {
  @PrimaryColumn()
  public blockHash!: string;

  @Column("integer")
  public chainId!: number;

  @Column("integer")
  public blockNumber!: number;

  @CreateDateColumn()
  public createdAt!: Date;
}
