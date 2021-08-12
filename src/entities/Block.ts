import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

@Entity({ name: "block" })
export class Block {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column("varchar")
  public blockTime!: number;

  @Column({
    type: "varchar",
    unique: true,
  })
  public blockNumber!: number;

  @CreateDateColumn()
  public createdAt!: Date;
}
