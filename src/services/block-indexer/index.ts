import TokenSaleContract from "@nodefactoryio/ryu-contracts/artifacts/contracts/SaleContract.sol/SaleContract.json";
import SwapFactoryContract from "@nodefactoryio/ryu-contracts/artifacts/contracts/SaleContractFactory.sol/SaleContractFactory.json";
import deployments from "@nodefactoryio/ryu-contracts/deployments/deployments.json";
import Bull, { Queue } from "bull";
import { ethers } from "ethers";

import { BlockRepository } from "../../repositories/BlockRepository";
import { SaleContractRepository } from "../../repositories/SaleContractRepository";
import { logger } from "../logger";
import { retry } from "../utils";
/* eslint-disable @typescript-eslint/naming-convention */
interface Iconfig {
  REDIS_HOST: string;
  REDIS_PORT: number;
  FACTORY_DEPLOYMENT_BLOCK: number;
  NETWORK_URL: string;
  NETWORK: string;
  CHAIN_ID: number;
  FACTORY_CONTRACT_NAME: string;
  TOKEN_SALE_CONTRACT_NAME: string;
}

export class Indexer {
  private blockRepository: BlockRepository;
  private saleContractRepository: SaleContractRepository;
  private config: Iconfig;
  private provider!: ethers.providers.BaseProvider;
  private saleContractAddresses: string[];
  private mintQueue: Queue;
  private tokenSaleIface: ethers.utils.Interface;
  private factoryIface: ethers.utils.Interface;
  constructor(
    config: Iconfig,
    blockRepository: BlockRepository,
    saleContractRepository: SaleContractRepository
  ) {
    this.config = config;
    this.blockRepository = blockRepository;
    this.saleContractRepository = saleContractRepository;
    this.saleContractAddresses = [];
    this.tokenSaleIface = new ethers.utils.Interface(TokenSaleContract.abi);
    this.factoryIface = new ethers.utils.Interface(SwapFactoryContract.abi);

    try {
      this.provider = new ethers.providers.JsonRpcProvider(
        this.config.NETWORK_URL,
        this.config.CHAIN_ID
      );
    } catch (err) {
      logger.error("Error occured during provider instantiation");
      throw err;
    }

    this.mintQueue = new Bull("mint", {
      redis: { host: this.config.REDIS_HOST, port: this.config.REDIS_PORT },
    });
  }

  public async start(): Promise<void> {
    // subscribe on new block events and handle new blocks
    this.saleContractAddresses =
      await this.saleContractRepository.getAllAddresses();

    // process all unhandled blocks
    await this.processPastClaimEvents();
    this.provider.on("block", this.blockEventListener);
  }

  public stop(): void {
    logger.info("Stop listening to all events");
    this.provider.off("block", this.blockEventListener);
  }

  private async processPastClaimEvents(): Promise<void> {
    // fetch the latest block from database
    const latestBlock = await this.blockRepository.getLatestBlock();

    let fromToBlock =
      latestBlock?.blockNumber || this.config.FACTORY_DEPLOYMENT_BLOCK;

    let fetchNewBlocks = true;
    while (fetchNewBlocks) {
      await retry(
        async () => {
          const headBlock = await this.provider.getBlockNumber();
          await this.handleBlock(fromToBlock, fromToBlock);
          if (fromToBlock === headBlock) {
            fetchNewBlocks = false;
          }
          fromToBlock++;
        },
        {
          retries: 3,
        }
      );
    }
  }

  private async handleBlock(fromBlock: number, toBlock: number): Promise<void> {
    const logs = await this.provider.getLogs({
      fromBlock,
      toBlock,
    });
    let blockInserted = false;
    for (const log of logs) {
      // insert block
      if (!blockInserted) {
        await this.blockRepository.insertBlock({
          blockHash: log.blockHash,
          chainId: this.config.CHAIN_ID,
          blockNumber: log.blockNumber,
        });
        blockInserted = true;
      }

      // if the log comes from the saleContract check if the log contains Claim event
      if (this.saleContractAddresses.includes(log.address)) {
        const parsedLog = await this.tokenSaleIface.parseLog(log);
        logger.info(parsedLog, "Handle event");

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
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        deployments[this.config.CHAIN_ID][this.config.NETWORK].contracts[
          this.config.FACTORY_CONTRACT_NAME
        ].address
      ) {
        const parsedLog = await this.factoryIface.parseLog(log);
        logger.info(parsedLog, "Handle event");

        if (parsedLog.name === "CreatedSaleContract") {
          const saleContract = {
            address: parsedLog.args?.tokenSaleAddress,
            blockHash: log.blockHash,
          };

          await this.saleContractRepository.insertSaleContract(saleContract);
          this.saleContractAddresses.push(parsedLog.args?.tokenSaleAddress);
        }
      }
    }
  }
  private blockEventListener = async (blockNumber: number): Promise<void> => {
    logger.info(`New block is mined(${blockNumber})`);
    await retry(
      () => {
        this.handleBlock(blockNumber, blockNumber);
      },
      {
        retries: 3,
      }
    );
  };
}
