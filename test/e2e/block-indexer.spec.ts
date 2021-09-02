import EventEmitter from "events";

import Bull, { Job, Queue } from "bull";
import { expect } from "chai";
import envSchema from "env-schema";
import sinon from "sinon";
import { Connection } from "typeorm";

import { blockIndexerConfig, Env } from "../../src/config";
import { Block } from "../../src/entities";
import { BlockRepository } from "../../src/repositories/BlockRepository";
import { SaleContractRepository } from "../../src/repositories/SaleContractRepository";
import { BlockIndexer } from "../../src/services/block-indexer";
import { getDatabaseConnection } from "../../src/services/db";
import { logger } from "../../src/services/logger";
import { QueueType } from "../../src/services/queue";
import * as utils from "../../src/services/utils";

describe("Block-indexer e2e test", async function () {
  // factoryContract address that is used to create saleContracts
  const factoryContractAddress = "0x89E1C97c58f7e454A1B05A3080E35d74Bce01b82";
  let mintQueue: Queue<QueueType.CLAIM_EXECUTOR>;
  let saleContractRepo: SaleContractRepository;
  let blockRepo: BlockRepository;
  let config: Env;
  let blockIndexer: BlockIndexer;
  let db: Connection;
  let emiter: EventEmitter;

  before(async function () {
    config = envSchema<Env>(blockIndexerConfig);
    db = await getDatabaseConnection();

    mintQueue = new Bull(QueueType.CLAIM_EXECUTOR, {
      redis: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
      },
    });
    emiter = new EventEmitter();
    saleContractRepo = db.getCustomRepository(SaleContractRepository);
    // get saleContract addresses
    const saleContractAddresses = await saleContractRepo.getAllAddresses();
    blockRepo = db.getCustomRepository(BlockRepository);
    blockIndexer = new BlockIndexer(
      config,
      blockRepo,
      saleContractAddresses,
      saleContractRepo,
      mintQueue
    );
  });

  after(async function () {
    try {
      await blockIndexer?.stop();
    } catch (e) {
      logger.error(`Error occurred during indexer stoppage: ${e.message}`);
    }

    try {
      await db?.close();
    } catch (error) {
      logger.error(
        `Error occurred during database closing because: ${error.message}`
      );
    }
    try {
      await mintQueue?.close();
    } catch (error) {
      logger.error(
        `Error occurred during redis closing because: ${error.message}`
      );
    }
  });

  beforeEach(async function () {
    sinon.stub(utils, "getFactoryContractAddress").callsFake(() => {
      return factoryContractAddress;
    });
  });

  afterEach(async function () {
    // stop processing blocks and unsubscribe
    await blockIndexer.stop();
    sinon.restore();
  });

  it("should process SaleCreated", async function () {
    const fromBlock = 664365;
    const toBlock = 664367;
    blockIndexer.start(emiter, fromBlock, toBlock);
    // after 2 seconds of processing blocks return saleContracts and blocks that are processed
    const {
      saleContracts,
      blocks,
    }: { saleContracts: string[]; blocks: Block[] } = await new Promise(
      (resolve) =>
        emiter.on("processingBlocksDone", async () => {
          const saleContracts = await saleContractRepo.getAllAddresses();
          const blocks = await blockRepo.find();
          resolve({ saleContracts, blocks });
        })
    );
    expect(saleContracts.length).to.equal(2);
    expect(saleContracts).to.be.deep.equal([
      "0xe9a8c99100931cac666f5cea31c4370f684b9168",
      "0x56de6eee7421bfe9e5fdd14f385f0e69cc39a9a8",
    ]);
    const blockData = blocks.map((block) => {
      return { blockHash: block.blockHash, blockNumber: block.blockNumber };
    });
    expect(blockData[0]).to.be.deep.equal({
      blockHash:
        "0xaef3dda5a1e771f53a9b35c6d24fa9f07078068d784044a4e751f36d76aa14af",
      blockNumber: 664365,
    });

    expect(blockData[1]).to.be.deep.equal({
      blockHash:
        "0x810ef866fb3642ed3402ec3910786d43456f51786f4a275bb34345a7d5c440e8",
      blockNumber: 664366,
    });

    expect(blockData[2]).to.be.deep.equal({
      blockHash:
        "0xb947a8cc409cee266b89b3e82a245011eb6f5191b4bb86103382f06508181588",
      blockNumber: 664367,
    });
  });

  it("should process claim events", async function () {
    const fromBlock = 664443;
    const toBlock = 664444;

    blockIndexer.start(emiter, fromBlock, toBlock);
    // process blocks for 2sec
    let jobs: Job[] = await new Promise((resolve) =>
      emiter.on("processingBlocksDone", async () => {
        const jobs = await mintQueue.getJobs([
          "completed",
          "waiting",
          "active",
          "delayed",
          "failed",
          "paused",
        ]);
        resolve(jobs);
      })
    );

    jobs = jobs.map((job) => job.data);
    expect(jobs.length).to.be.equal(2);
    expect(jobs).to.be.deep.equal([
      {
        amount: 10,
        token: [1, 5, "walletadd"],
        txHash:
          "0x333f0d58cd16cd573d04b1770e3db26e79e6a0319a78e046a5a3fccdea37ce23",
        blockNumber: 664444,
      },
      {
        amount: 10000,
        token: [1, 5, "walletadd"],
        txHash:
          "0x912259099f1495fa5385f72d799c543ae7b114ca605bb24618b024909da52327",
        blockNumber: 664443,
      },
    ]);
  });
});
