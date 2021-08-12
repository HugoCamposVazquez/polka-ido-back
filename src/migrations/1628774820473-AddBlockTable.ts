import {MigrationInterface, QueryRunner} from "typeorm";

export class AddBlockTable1628774820473 implements MigrationInterface {
    name = 'AddBlockTable1628774820473'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "block" ("id" SERIAL NOT NULL, "blockTime" character varying NOT NULL, "blockNumber" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d0925763efb591c2e2ffb267572" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "block"`);
    }

}
