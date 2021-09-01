import { Log } from "@ethersproject/abstract-provider";
import TokenSaleContract from "@nodefactoryio/ryu-contracts/artifacts/contracts/SaleContract.sol/SaleContract.json";
import SwapFactoryContract from "@nodefactoryio/ryu-contracts/artifacts/contracts/SaleContractFactory.sol/SaleContractFactory.json";
import { Queue } from "bull";
import { ethers } from "ethers";

import { BlockRepository } from "../../repositories/BlockRepository";
import { SaleContractRepository } from "../../repositories/SaleContractRepository";
import { logger } from "../logger";
import { getFactoryContractAddress, retry } from "../utils";
/* eslint-disable @typescript-eslint/naming-convention */
export interface Iconfig {
  REDIS_HOST: string;
  REDIS_PORT: number;
  FACTORY_DEPLOYMENT_BLOCK: number;
  NETWORK_URL: string;
  NETWORK: string;
  CHAIN_ID: number;
  FACTORY_CONTRACT_NAME: string;
  TOKEN_SALE_CONTRACT_NAME: string;
  REORG_PROTECTION_COUNT: number;
}

export class BlockIndexer {
  private blockRepository: BlockRepository;
  public config: Iconfig;
  private provider!: ethers.providers.BaseProvider;
  private saleContractAddresses: string[];
  private saleContractRepository;
  public mintQueue: Queue;
  private tokenSaleIface: ethers.utils.Interface;
  private factoryIface: ethers.utils.Interface;
  private fetchNewBlocks = true;
  constructor(
    config: Iconfig,
    blockRepository: BlockRepository,
    saleContractAddresses: string[],
    saleContractRepository: SaleContractRepository,
    mintQueue: Queue
  ) {
    this.config = config;
    this.blockRepository = blockRepository;
    this.saleContractAddresses = saleContractAddresses;
    this.saleContractRepository = saleContractRepository;
    this.tokenSaleIface = new ethers.utils.Interface(TokenSaleContract.abi);
    this.factoryIface = new ethers.utils.Interface(SwapFactoryContract.abi);
    this.mintQueue = mintQueue;
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
    // process all unhandled blocks
    await this.processPastClaimEvents(fromBlock, toBlock);
    this.provider.on("block", this.blockEventListener);
  }

  public stop(): void {
    logger.info("Stop listening to all events");
    this.provider.off("block", this.blockEventListener);
    this.fetchNewBlocks = false;
  }

  public async processPastClaimEvents(
    fromBlock?: number,
    toBlock?: number
  ): Promise<void> {
    // fetch the latest block from database

    if (!fromBlock) {
      const latestBlock = await this.blockRepository.getLatestBlock();

      fromBlock =
        latestBlock?.blockNumber || this.config.FACTORY_DEPLOYMENT_BLOCK;
    }

    try {
      while (this.fetchNewBlocks) {
        const headBlock = toBlock || (await retry(this.getHeadBlock));
        // break when all past blocks processed
        if (headBlock < fromBlock) {
          break;
        }

        this.handleBlock(fromBlock);
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
      if (this.saleContractAddresses.includes(log.address)) {
        const parsedLog = await this.tokenSaleIface.parseLog(log);
        logger.info(parsedLog, "Handling saleContract event");

        if (parsedLog.name === "Claim") {
          const data = {
            substrateAdd: parsedLog.args?.substrateAddress,
            amount: parsedLog.args?.amount.toNumber(),
            token: parsedLog.args?.token,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
          };
          await this.mintQueue.add(data);
        }
        // if the log comes from factoryContract check if the log contains CreatedSaleContract event
      } else if (
        log.address ===
        getFactoryContractAddress(
          this.config.CHAIN_ID,
          this.config.NETWORK,
          this.config.FACTORY_CONTRACT_NAME
        )
      ) {
        const parsedLog = await this.factoryIface.parseLog(log);
        logger.info(parsedLog, "Handling factoryContract event");

        if (parsedLog.name === "CreatedSaleContract") {
          const saleContract = {
            id: `${this.config.CHAIN_ID}_${parsedLog.args?.tokenSaleAddress}`,
            address: parsedLog.args?.tokenSaleAddress,
            chainId: this.config.CHAIN_ID,
            blockHash: log.blockHash,
          };

          await this.saleContractRepository.insertSaleContract(saleContract);
          this.saleContractAddresses.push(parsedLog.args?.tokenSaleAddress);
        }
      }
    }
  }

  public blockEventListener = async (blockNumber: number): Promise<void> => {
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
  }

  private getHeadBlock = async (): Promise<number> => {
    return (
      (await this.provider.getBlockNumber()) -
      this.config.REORG_PROTECTION_COUNT
    );
  };
}
