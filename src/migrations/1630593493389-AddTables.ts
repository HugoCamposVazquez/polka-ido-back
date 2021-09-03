import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTables1630593493389 implements MigrationInterface {
  name = "AddTables1630593493389";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "block" ("blockHash" character varying NOT NULL, "chainId" integer NOT NULL, "blockNumber" integer NOT NULL, "error" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ce8d7e169def9583aefa21760f3" PRIMARY KEY ("blockHash"))`
    );
    await queryRunner.query(
      `CREATE TABLE "saleContract" ("id" character varying NOT NULL, "address" character varying NOT NULL, "chainId" integer NOT NULL, "blockHash" character varying NOT NULL, "walletAddress" character varying NOT NULL, CONSTRAINT "PK_cf5c84ec5f44ca7f2d622a276c4" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "claims" ("claimTxHash" character varying NOT NULL, "receiver" character varying NOT NULL, "amount" character varying NOT NULL, "status" character varying NOT NULL, "saleContractId" character varying NOT NULL, CONSTRAINT "PK_a46e10316f885805fbcc7519692" PRIMARY KEY ("claimTxHash"))`
    );
    await queryRunner.query(
      `ALTER TABLE "saleContract" ADD CONSTRAINT "FK_3863f58566468673425e9ae3b42" FOREIGN KEY ("blockHash") REFERENCES "block"("blockHash") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "claims" ADD CONSTRAINT "FK_720ebf2ed902a6ddf93211059c0" FOREIGN KEY ("saleContractId") REFERENCES "saleContract"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "claims" DROP CONSTRAINT "FK_720ebf2ed902a6ddf93211059c0"`
    );
    await queryRunner.query(
      `ALTER TABLE "saleContract" DROP CONSTRAINT "FK_3863f58566468673425e9ae3b42"`
    );
    await queryRunner.query(`DROP TABLE "claims"`);
    await queryRunner.query(`DROP TABLE "saleContract"`);
    await queryRunner.query(`DROP TABLE "block"`);
  }
}
