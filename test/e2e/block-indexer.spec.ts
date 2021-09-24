import { Job, Queue } from "bullmq";
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
  const factoryContractAddress = "0x95960cC7f1B199FD309Ab551416bcD5a4140ddb2";
  let mintQueue: Queue<QueueType.CLAIM_EXECUTOR>;
  let saleContractRepo: SaleContractRepository;
  let blockRepo: BlockRepository;
  let config: Env;
  let blockIndexer: BlockIndexer;
  let db: Connection;

  before(async function () {
    config = envSchema<Env>(blockIndexerConfig);
    db = await getDatabaseConnection();
    await db.runMigrations({ transaction: "all" });

    mintQueue = new Queue(QueueType.CLAIM_EXECUTOR, {
      connection: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
      },
    });
    saleContractRepo = db.getCustomRepository(SaleContractRepository);
    // get saleContract addresses
    blockRepo = db.getCustomRepository(BlockRepository);
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
    logger.level = "silent";
    sinon.stub(utils, "getFactoryContractAddress").callsFake(() => {
      return factoryContractAddress;
    });
  });

  afterEach(async function () {
    logger.level = "info";
    // stop processing blocks and unsubscribe
    await blockIndexer.stop();
    sinon.restore();
  });

  it("should process SaleCreated", async function () {
    const fromBlock = 763954;
    const toBlock = 763956;

    blockIndexer = new BlockIndexer(
      config,
      blockRepo,
      [],
      saleContractRepo,
      mintQueue
    );
    blockIndexer.start(fromBlock, toBlock);
    // after 2 seconds of processing blocks return saleContracts and blocks that are processed
    const {
      saleContracts,
      blocks,
    }: { saleContracts: string[]; blocks: Block[] } = await new Promise(
      (resolve) =>
        blockIndexer.emiter.on("processingBlocksDone", async () => {
          const saleContracts = await saleContractRepo.getAllAddresses();
          const blocks = await blockRepo.find();
          resolve({ saleContracts, blocks });
        })
    );
    expect(saleContracts.length).to.equal(2);
    expect(saleContracts).to.be.deep.equal([
      "0xee79c1e4016b99dfa6e096a014a56a87b7a67679",
      "0xf4d343913474196e5c4ae7a3d4558a52931c9e8c",
    ]);
    const blockData = blocks.map((block) => {
      return { blockHash: block.blockHash, blockNumber: block.blockNumber };
    });
    expect(blockData[0]).to.be.deep.equal({
      blockHash:
        "0x6a9517b08d44f2bae0f1bfa65486dddd225eab9ff4639293b7d5867d0fff2576",
      blockNumber: 763954,
    });

    expect(blockData[1]).to.be.deep.equal({
      blockHash:
        "0x941add41aeb95a54768696fbd224ca6ca27e0aa1ea2674f4d79d4ad34fe9d52e",
      blockNumber: 763955,
    });

    expect(blockData[2]).to.be.deep.equal({
      blockHash:
        "0xd606e4fc387e0f2bda5475d497df8074b09522320ac69c18594d050c02624ef3",
      blockNumber: 763956,
    });
  });

  it("should process claim events", async function () {
    const fromBlock = 764186;
    const toBlock = 764199;

    blockIndexer = new BlockIndexer(
      config,
      blockRepo,
      [
        "0xee79c1e4016b99dfa6e096a014a56a87b7a67679",
        "0xf4d343913474196e5c4ae7a3d4558a52931c9e8c",
      ],
      saleContractRepo,
      mintQueue
    );
    blockIndexer.start(fromBlock, toBlock);
    let jobs: Job[] = await new Promise((resolve) =>
      blockIndexer.emiter.on("processingBlocksDone", async () => {
        const jobs = await mintQueue.getJobs(["waiting"]);
        resolve(jobs);
      })
    );

    jobs = jobs.map((job) => job.data);
    expect(jobs.length).to.be.equal(2);
    expect(jobs).to.be.deep.equal([
      {
        walletAddress: "walletadd",
        amount: "5040",
        claimTxHash:
          "0x8ffac0f767d998135eaa4750cefa87ea2ad5980e351311e7d16e78e5fcdd51fe",
        saleContractId: "0xf4d343913474196e5c4ae7a3d4558a52931c9e8c",
        tokenId: 1,
        receiver: "5EcFhFHrL53MQWuJWCKCTGhHBJsWZ7Yn3TXpzCTYj6H4eoCy",
      },
      {
        walletAddress: "walletadd",
        amount: "5040",
        claimTxHash:
          "0x9888fd30b02bbe28c9f2a8b32d61b91f694d38e0519d4068777b257c6a18e3f8",
        saleContractId: "0xee79c1e4016b99dfa6e096a014a56a87b7a67679",
        tokenId: 1,
        receiver: "5EcFhFHrL53MQWuJWCKCTGhHBJsWZ7Yn3TXpzCTYj6H4eoCy",
      },
    ]);
  });
});
