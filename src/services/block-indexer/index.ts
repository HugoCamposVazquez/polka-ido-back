import EventEmitter from "events";

import { Log } from "@ethersproject/abstract-provider";
import TokenSaleContract from "@nodefactoryio/ryu-contracts/artifacts/contracts/SaleContract.sol/SaleContract.json";
import SwapFactoryContract from "@nodefactoryio/ryu-contracts/artifacts/contracts/SaleContractFactory.sol/SaleContractFactory.json";
import { Queue } from "bullmq";
import { ethers } from "ethers";

import { BlockRepository } from "../../repositories/BlockRepository";
import { SaleContractRepository } from "../../repositories/SaleContractRepository";
import { logger } from "../logger";
import { ClaimData, QueueType } from "../queue";
import { getFactoryContractAddress, retry } from "../utils";

/* eslint-disable @typescript-eslint/naming-convention */
export interface Iconfig {
  FACTORY_DEPLOYMENT_BLOCK: number;
  NETWORK_URL: string;
  NETWORK: string;
  CHAIN_ID: number;
  FACTORY_CONTRACT_NAME: string;
  REORG_PROTECTION_COUNT: number;
}

export class BlockIndexer extends EventEmitter {
  private blockRepository: BlockRepository;
  public config: Iconfig;
  public emiter: EventEmitter;
  private provider!: ethers.providers.BaseProvider;
  private saleContractAddresses: string[];
  private saleContractRepository;
  public mintQueue: Queue<ClaimData>;
  private tokenSaleIface: ethers.utils.Interface;
  private factoryIface: ethers.utils.Interface;
  private fetchNewBlocks = true;
  private factoryContractAddress: string | null;

  constructor(
    config: Iconfig,
    blockRepository: BlockRepository,
    saleContractAddresses: string[],
    saleContractRepository: SaleContractRepository,
    mintQueue: Queue
  ) {
    super();
    this.config = config;
    this.blockRepository = blockRepository;
    this.saleContractAddresses = saleContractAddresses;
    this.saleContractRepository = saleContractRepository;
    this.tokenSaleIface = new ethers.utils.Interface(TokenSaleContract.abi);
    this.factoryIface = new ethers.utils.Interface(SwapFactoryContract.abi);
    this.mintQueue = mintQueue;
    this.emiter = new EventEmitter();
    this.factoryContractAddress = getFactoryContractAddress(
      this.config.CHAIN_ID,
      this.config.NETWORK,
      this.config.FACTORY_CONTRACT_NAME
    );
    if (!this.factoryContractAddress) {
      throw new Error(
        `Contract with ${this.config.FACTORY_CONTRACT_NAME} name not found in deployments with ${this.config.NETWORK}(${this.config.CHAIN_ID})`
      );
    }

    try {
      this.provider = new ethers.providers.JsonRpcProvider(
        this.config.NETWORK_URL,
        this.config.CHAIN_ID
      );
    } catch (err) {
      logger.error("Error occured during provider instantiation");
      throw err;
    }
  }

  public async start(fromBlock?: number, toBlock?: number): Promise<void> {
    this.fetchNewBlocks = true;
    // process all unhandled blocks
    await this.processBlocks(fromBlock, toBlock);
    this.emiter.emit("processingBlocksDone");
    if (this.fetchNewBlocks) {
      this.provider.on("block", this.blockEventListener);
    }
  }

  public stop(): void {
    logger.info("Stop listening to all events");
    this.fetchNewBlocks = false;
    this.provider.off("block", this.blockEventListener);
  }

  public async processBlocks(
    fromBlock?: number,
    toBlock?: number
  ): Promise<void> {
    // fetch the latest block from database
    if (!fromBlock) {
      const latestBlock = await this.blockRepository.getLatestBlock();

      fromBlock =
        latestBlock?.blockNumber || this.config.FACTORY_DEPLOYMENT_BLOCK;

      fromBlock++;
    }

    try {
      while (this.fetchNewBlocks) {
        const headBlock = toBlock || (await retry(this.getHeadBlock));
        // break when all past blocks processed
        if (headBlock < fromBlock) {
          break;
        }

        await this.handleBlock(fromBlock);
        fromBlock++;
      }
    } catch (err) {
      logger.error(`Error while processing past claim events: ${err.stack}`);
      // hack: insert for blockHash block number
      await this.blockRepository.insertBlock({
        blockHash: fromBlock.toString(),
        chainId: this.config.CHAIN_ID,
        blockNumber: fromBlock,
        error: err.stack,
      });
      fromBlock++;
    }
  }

  private async handleLogs(logs: Log[]): Promise<void> {
    for (const log of logs) {
      logger.trace(log, "Handling the log");
      // if the log comes from the saleContract check if the log contains Claim event
      if (this.saleContractAddresses.includes(log.address.toLowerCase())) {
        const parsedLog = await this.tokenSaleIface.parseLog(log);
        logger.info(parsedLog, "Handling saleContract event");

        if (parsedLog.name === "Claim") {
          const data = {
            walletAddress: parsedLog.args.token.walletAddress,
            receiver: parsedLog.args.statemintReceiver,
            amount: parsedLog.args.amount.toString(),
            claimTxHash: log.transactionHash,
            tokenId: parsedLog.args?.token.tokenID,
            saleContractId: log.address.toLowerCase(),
          };
          await this.mintQueue.add(QueueType.CLAIM_EXECUTOR, data);
        }
        // if the log comes from factoryContract check if the log contains CreatedSaleContract event
      } else if (log.address === this.factoryContractAddress) {
        const parsedLog = await this.factoryIface.parseLog(log);
        logger.info(parsedLog, "Handling factoryContract event");

        if (parsedLog.name === "CreatedSaleContract") {
          const saleContract = {
            id: parsedLog.args?.tokenSaleAddress,
            walletAddress: parsedLog.args.token.walletAddress,
            chainId: this.config.CHAIN_ID,
            blockHash: log.blockHash,
          };

          await this.saleContractRepository.insertSaleContract(saleContract);
          this.saleContractAddresses.push(
            parsedLog.args?.tokenSaleAddress.toLowerCase()
          );
        }
      }
    }
  }

  private blockEventListener = async (blockNumber: number): Promise<void> => {
    logger.info(`New block is mined(${blockNumber})`);
    blockNumber = blockNumber - this.config.REORG_PROTECTION_COUNT;
    try {
      await this.handleBlock(blockNumber);
    } catch (err) {
      // hack: insert for blockHash block number
      await this.blockRepository.insertBlock({
        blockHash: blockNumber.toString(),
        chainId: this.config.CHAIN_ID,
        blockNumber: blockNumber,
        error: err.stack,
      });
    }
  };

  private async handleBlock(blockNumber: number): Promise<void> {
    if (this.fetchNewBlocks) {
      logger.info(`Started processing block number ${blockNumber}`);
      const logs = await retry(async () => {
        return await this.provider.getLogs({
          fromBlock: blockNumber,
          toBlock: blockNumber,
        });
      });
      if (logs.length) {
        await this.blockRepository.insertBlock({
          blockHash: logs[0].blockHash,
          chainId: this.config.CHAIN_ID,
          blockNumber: logs[0].blockNumber,
        });
      }
      await this.handleLogs(logs);
      logger.info(`Block number ${blockNumber} has been processed`);
    } else {
      this.emiter.emit("processingBlocksDone");
    }
  }

  private getHeadBlock = async (): Promise<number> => {
    return (
      (await this.provider.getBlockNumber()) -
      this.config.REORG_PROTECTION_COUNT
    );
  };
}
