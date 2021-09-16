import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveWalletAddress1631693642793 implements MigrationInterface {
  name = "removeWalletAddress1631693642793";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."saleContract" DROP COLUMN "walletAddress"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."saleContract" ADD "walletAddress" character varying NOT NULL`
    );
  }
}
