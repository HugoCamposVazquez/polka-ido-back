import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";

import { Block } from "./Block";

@Entity({ name: "saleContract" })
export class SaleContract {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column("varchar")
  public address!: string;

  @Column()
  public blockHash!: string;

  @ManyToOne(() => Block, (block) => block.blockHash)
  @JoinColumn({
    name: "blockHash",
  })
  block!: Block;
}
