import { Column, Entity, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity({ name: "block" })
export class Block {
  @PrimaryColumn()
  public blockHash!: string;

  @Column("integer")
  public chainId!: number;

  @Column("integer")
  public blockNumber!: number;

  @Column({ type: "varchar", nullable: true })
  public error!: string;

  @CreateDateColumn()
  public createdAt!: Date;
}
