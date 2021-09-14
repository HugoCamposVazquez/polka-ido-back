import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveSaleContractAddressField1631628782809
  implements MigrationInterface
{
  name = "RemoveSaleContractAddressField1631628782809";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."saleContract" DROP COLUMN "address"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public"."saleContract" ADD "address" character varying NOT NULL`
    );
  }
}
