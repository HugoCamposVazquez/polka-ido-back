import Bull, { Queue } from "bull";
import envSchema from "env-schema";
import { ethers } from "ethers";
import { Connection } from "typeorm";

import { blockIndexerConfig, Env } from "./config";
import { BlockRepository } from "./repositories/BlockRepository";
import { SaleContractRepository } from "./repositories/SaleContractRepository";
import { BlockIndexer } from "./services/block-indexer";
import { getDatabaseConnection } from "./services/db";
import { logger } from "./services/logger";
export class Indexer {
  // eslint-disable-next-line
  public readonly instance: any;
  constructor() {
    this.instance = {};
  }
  public async init(): Promise<void> {
    this.instance.config = envSchema<Env>(blockIndexerConfig);
    this.instance.db = await getDatabaseConnection();
    await this.instance.db.runMigrations({ transaction: "all" });

    this.instance.mintQueue = new Bull("mint", {
      redis: {
        host: this.instance.config.REDIS_HOST,
        port: this.instance.config.REDIS_PORT,
      },
    });
  }

  public async start(fromBlock?: number, toBlock?: number): Promise<void> {
    try {
      const salecontractRepo = this.instance.db.getCustomRepository(
        SaleContractRepository
      );
      // get saleContract addresses
      const saleContractAddresses = await salecontractRepo.getAllAddresses();

      this.instance.blockIndexer = new BlockIndexer(
        this.instance.config,
        this.instance.db.getCustomRepository(BlockRepository),
        saleContractAddresses,
        salecontractRepo,
        this.instance.mintQueue
      );

      // process all unhandled blocks
      await this.instance.blockIndexer.processPastClaimEvents(
        fromBlock,
        toBlock
      );
      const provider = new ethers.providers.JsonRpcProvider(
        this.instance.config.NETWORK_URL,
        this.instance.config.CHAIN_ID
      );

      provider.on("block", this.instance.blockIndexer.blockEventListener);
    } catch (error) {
      logger.error(
        `Error occurred during app startup because of: ${error.stack}`
      );
      this.stop(undefined);
    }
  }

  public async stop(signal: string | undefined): Promise<void> {
    await this.instance.db
      ?.close()
      .catch((error: Error) =>
        logger.error(
          `Error occurred during database closing because: ${error.message}`
        )
      );
    try {
      await this.instance.blockIndexer?.stop();
    } catch (e) {
      logger.error(`Error occurred during indexer stoppage: ${e.message}`);
    }

    if (signal !== "TEST") {
      process.kill(process.pid, signal);
    }
  }

  // mostly for testing purposes
  get instanceHandlers(): {
    db: Connection;
    blockIndexer: BlockIndexer;
    // eslint-disable-next-line
    mintQueue: Queue<any>;
    config: Env;
  } {
    return this.instance;
  }
}
