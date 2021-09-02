import EventEmitter from "events";

import Bull, { Queue } from "bull";
import envSchema from "env-schema";
import { Connection } from "typeorm";

import { blockIndexerConfig, Env } from "./config";
import { BlockRepository } from "./repositories/BlockRepository";
import { SaleContractRepository } from "./repositories/SaleContractRepository";
import { BlockIndexer } from "./services/block-indexer";
import { getDatabaseConnection } from "./services/db";
import { logger } from "./services/logger";
import { QueueType } from "./services/queue";

interface Iinstance {
  db: Connection;
  blockIndexer: BlockIndexer;
  // eslint-disable-next-line
  mintQueue: Queue<QueueType.CLAIM_EXECUTOR>;
  config: Env;
  emiter: EventEmitter;
}
export class Indexer {
  // eslint-disable-next-line
  public readonly instance: Iinstance;
  private stopped = false;
  constructor() {
    this.instance = {} as Iinstance;
  }
  public async init(): Promise<void> {
    this.instance.config = envSchema<Env>(blockIndexerConfig);
    this.instance.db = await getDatabaseConnection();
    await this.instance.db.runMigrations({ transaction: "all" });

    this.instance.mintQueue = new Bull(QueueType.CLAIM_EXECUTOR, {
      redis: {
        host: this.instance.config.REDIS_HOST,
        port: this.instance.config.REDIS_PORT,
      },
    });
    this.instance.emiter = new EventEmitter();
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
      await this.instance.blockIndexer.start(
        this.instance.emiter,
        fromBlock,
        toBlock
      );
    } catch (error) {
      logger.error(
        `Error occurred during app startup because of: ${error.stack}`
      );
      this.stop();
    }
  }

  public async stop(): Promise<void> {
    if (!this.stopped) {
      try {
        this.instance.blockIndexer?.stop();
      } catch (e) {
        logger.error(`Error occurred during indexer stoppage: ${e.message}`);
      }

      this.instance.emiter.on("processingBlocksDone", async () => {
        try {
          await this.instance.db?.close();
        } catch (error) {
          logger.error(
            `Error occurred during database closing because: ${error.message}`
          );
        }
        try {
          await this.instance.mintQueue?.close();
        } catch (error) {
          logger.error(
            `Error occurred during redis closing because: ${error.message}`
          );
        }
      });

      this.stopped = true;
    }
  }

  // mostly for testing purposes
  get instanceHandlers(): Iinstance {
    return this.instance;
  }
}
