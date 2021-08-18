import TokenSaleContract from "@nodefactoryio/ryu-contracts/artifacts/contracts/SaleContract.sol/SaleContract.json";
import SwapFactoryContract from "@nodefactoryio/ryu-contracts/artifacts/contracts/SaleContractFactory.sol/SaleContractFactory.json";
import deployments from "@nodefactoryio/ryu-contracts/deployments/deployments.json";
import { Queue } from "bullmq";
import { Contract, ethers } from "ethers";

import { BlockRepository } from "../../repositories/BlockRepository";
import { SaleContractRepository } from "../../repositories/SaleContractRepository";
import { logger } from "../logger";
import { QueueType } from "../queue";
import { retry, isTimeOutError } from "../utils";
/* eslint-disable @typescript-eslint/naming-convention */
interface Iconfig {
  REDIS_URL: string;
  FACTORY_DEPLOYMENT_BLOCK: number;
  NETWORK_URL: string;
  NETWORK: string;
  CHAIN_ID: number;
  FACTORY_CONTRACT_NAME: string;
  TOKEN_SALE_CONTRACT_NAME: string;
  PROCESSING_BLOCK_COUNT: number;
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

    this.mintQueue = new Queue(QueueType.CLAIM_EXECUTOR, {
      connection: {
        path: this.config.REDIS_URL,
      },
    });
  }

  public async start(): Promise<void> {
    // subscribe on new block events and handle new blocks
    const saleContracts = await this.saleContractRepository.getAllAddresses();
    this.saleContractAddresses = saleContracts.map(
      (contract) => contract.address
    );

    // process all unhandled blocks
    await this.processPastClaimEvents();
    this.provider.on("block", this.blockEventListener);
  }

  public stop(): void {
    logger.info("Stop listening to all events");
    this.provider.off("block", this.blockEventListener);
  }

  private async processPastClaimEvents(): Promise<void> {
    // fetch latest block from database which claim events are processed(minted)
    const latestBlock = await this.blockRepository.getLatestBlock();
    const headBlock = await this.provider.getBlockNumber();

    let fromBlock =
      latestBlock?.blockNumber || this.config.FACTORY_DEPLOYMENT_BLOCK;
    fromBlock++;

    let toBlock =
      fromBlock + this.config.PROCESSING_BLOCK_COUNT < headBlock
        ? fromBlock + this.config.PROCESSING_BLOCK_COUNT
        : headBlock;
    let fetchNewBlocks = true;
    while (fetchNewBlocks) {
      await retry(
        async () => {
          const headBlock = await this.provider.getBlockNumber();
          await this.handleBlock(fromBlock, toBlock);
          if (toBlock === headBlock) {
            fetchNewBlocks = false;
          }
          fromBlock += this.config.PROCESSING_BLOCK_COUNT;
          toBlock =
            fromBlock + this.config.PROCESSING_BLOCK_COUNT < headBlock
              ? fromBlock + this.config.PROCESSING_BLOCK_COUNT
              : headBlock;
        },
        {
          retries: 3,
          shouldRetry: isTimeOutError,
        }
      );
    }
  }

  private async handleBlock(fromBlock: number, toBlock: number): Promise<void> {
    const factoryContract = new Contract(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      deployments[this.config.CHAIN_ID][this.config.NETWORK].contracts[
        this.config.FACTORY_CONTRACT_NAME
      ].address, // "0xa85Db5325b493e04e71961f557409718E65bA85B",
      this.factoryIface,
      this.provider
    );

    const createdSaleContractFilter = factoryContract.filters.CreatedSaleContract();

    const claimFilter = {
      topics: [ethers.utils.id("Claim(string,uint,struct)")],
    };
    const claimLogs = await this.provider.getLogs({
      fromBlock,
      toBlock,
      topics: claimFilter.topics,
    });
    const crateSaleContractEvents = await factoryContract.queryFilter(
      createdSaleContractFilter,
      fromBlock,
      toBlock
    );

    crateSaleContractEvents.forEach(async (saleContractEvent) => {
      // handle CreatedSaleContract event
      const block = await saleContractEvent.getBlock();
      const saleContract = {
        address: saleContractEvent.args?.tokenSaleAddress,
        blockHash: block.hash,
      };

      await this.blockRepository.insertBlock({
        blockHash: block.hash,
        chainId: this.config.CHAIN_ID,
        blockTime: new Date(block.timestamp),
        blockNumber: block.number,
      });
      await this.saleContractRepository.insertSaleContract(saleContract);
      this.saleContractAddresses.push(saleContractEvent.args?.tokenSaleAddress);
    });

    claimLogs.forEach(async (claimLog) => {
      // handle claim event
      if (this.saleContractAddresses.includes(claimLog.address)) {
        const block = await this.provider.getBlock(claimLog.blockHash);
        const parsedLog = await this.tokenSaleIface.parseLog(claimLog);
        logger.info(claimLog, "Handle event");
        const data = {
          substrateAdd: parsedLog.args?.substrateAddress,
          amount: parsedLog.args?.amount.toNumber(),
          token: parsedLog.args?.token,
          txHash: claimLog.transactionHash,
          blockNumber: claimLog.blockNumber,
        };
        this.mintQueue.add(QueueType.CLAIM_EXECUTOR, data);
        this.blockRepository.insertBlock({
          blockHash: block.hash,
          chainId: this.config.CHAIN_ID,
          blockTime: new Date(block.timestamp),
          blockNumber: block.number,
        });
      }
    });
  }
  private blockEventListener = async (blockNumber: number): Promise<void> => {
    logger.info(`New block is mined(${blockNumber})`);
    await retry(
      () => {
        this.handleBlock(blockNumber, blockNumber);
      },
      {
        retries: 3,
        shouldRetry: isTimeOutError,
      }
    );
  };
}
