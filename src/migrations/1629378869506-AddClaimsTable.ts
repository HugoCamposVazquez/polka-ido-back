import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClaimsTable1629378869506 implements MigrationInterface {
  name = "AddClaimsTable1629378869506";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "claims" ("claimTxHash" character varying NOT NULL, "receiver" character varying NOT NULL, "amount" character varying NOT NULL, "status" character varying NOT NULL, "saleContractId" integer NOT NULL, CONSTRAINT "PK_a46e10316f885805fbcc7519692" PRIMARY KEY ("claimTxHash"))`
    );
    await queryRunner.query(
      `ALTER TABLE "public"."saleContract" ADD "walletAddress" character varying NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "public"."saleContract" ALTER COLUMN "id" DROP DEFAULT`
    );
    await queryRunner.query(`DROP SEQUENCE "public"."saleContract_id_seq"`);
    await queryRunner.query(
      `ALTER TABLE "claims" ADD CONSTRAINT "FK_720ebf2ed902a6ddf93211059c0" FOREIGN KEY ("saleContractId") REFERENCES "saleContract"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "claims" DROP CONSTRAINT "FK_720ebf2ed902a6ddf93211059c0"`
    );
    await queryRunner.query(
      `CREATE SEQUENCE IF NOT EXISTS "public"."saleContract_id_seq" OWNED BY "public"."saleContract"."id"`
    );
    await queryRunner.query(
      `ALTER TABLE "public"."saleContract" ALTER COLUMN "id" SET DEFAULT nextval('"public"."saleContract_id_seq"')`
    );
    await queryRunner.query(
      `ALTER TABLE "public"."saleContract" DROP COLUMN "walletAddress"`
    );
    await queryRunner.query(`DROP TABLE "claims"`);
  }
}
