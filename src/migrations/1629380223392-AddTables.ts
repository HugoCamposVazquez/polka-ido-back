import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTables1629380223392 implements MigrationInterface {
  name = "AddTables1629380223392";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "block" ("blockHash" character varying NOT NULL, "chainId" integer NOT NULL, "blockNumber" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ce8d7e169def9583aefa21760f3" PRIMARY KEY ("blockHash"))`
    );
    await queryRunner.query(
      `CREATE TABLE "saleContract" ("id" SERIAL NOT NULL, "address" character varying NOT NULL, "blockHash" character varying NOT NULL, CONSTRAINT "PK_cf5c84ec5f44ca7f2d622a276c4" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "saleContract" ADD CONSTRAINT "FK_3863f58566468673425e9ae3b42" FOREIGN KEY ("blockHash") REFERENCES "block"("blockHash") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saleContract" DROP CONSTRAINT "FK_3863f58566468673425e9ae3b42"`
    );
    await queryRunner.query(`DROP TABLE "saleContract"`);
    await queryRunner.query(`DROP TABLE "block"`);
  }
}
