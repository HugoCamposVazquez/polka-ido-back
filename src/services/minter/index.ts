import TokenSaleContract from "@nodefactoryio/ryu-contracts/artifacts/contracts/SaleContract.sol/SaleContract.json";
import SwapFactoryContract from "@nodefactoryio/ryu-contracts/artifacts/contracts/SaleContractFactory.sol/SaleContractFactory.json";
import deployments from "@nodefactoryio/ryu-contracts/deployments/deployments.json";
import { Contract, ethers } from "ethers";

import { BlockRepository } from "../../repositories/BlockRepository";
import { logger } from "../logger";
import { retry, isTimeOutError } from "../utils";
/* eslint-disable @typescript-eslint/naming-convention */
interface Iconfig {
  REDIS_URL: string;
  SWAP_FACTORY_ADDRESS: string;
  FACTORY_DEPLOYMENT_BLOCK: number;
  MINT_ATTEMPTS: number;
  STATEMINT_NETWORK_URL: string;
  STATEMINT_MINTING_WALLET_MNEMONIC: string;
  NETWORK_URL: string;
  NETWORK: string;
  CHAIN_ID: number;
  CONTRACT_NAME: string;
}

export class Minter {
  private blockRepository: BlockRepository;
  private config: Iconfig;
  private provider!: ethers.providers.JsonRpcProvider;
  private saleContractAddresses: string[];
  private tokenSaleIface: ethers.utils.Interface;
  constructor(config: Iconfig, blockRepository: BlockRepository) {
    this.config = config;
    this.blockRepository = blockRepository;
    this.saleContractAddresses = [];
    this.tokenSaleIface = new ethers.utils.Interface(TokenSaleContract.abi);
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

  public async start(): Promise<void> {
    // subscribe on new block events and handle new blocks
    this.provider.on("block", async (blockNumber) => {
      logger.info(`New block is mined(${blockNumber})`);
      await retry(
        () => {
          this.handleBlock(blockNumber, this.tokenSaleIface);
        },
        {
          retries: 3,
          shouldRetry: isTimeOutError,
        }
      );
    });
    const headBlock = await this.provider.getBlockNumber();
    // fetch all saleContracts from the factoryContract
    await this.fetchSaleContracts(headBlock);
    // process all unhandled blocks
    await this.processPastClaimEvents(headBlock);
  }

  public stop(): void {
    logger.info("Stop listening to all events");
    this.provider.removeAllListeners();
  }

  private async processPastClaimEvents(headBlock: number): Promise<void> {
    // fetch latest block from database which claim events are processed(minted)
    const latestBlock = await this.blockRepository.getLatestBlock();
    let currentBlock =
      latestBlock?.blockNumber || this.config.FACTORY_DEPLOYMENT_BLOCK;
    while (currentBlock < headBlock) {
      await retry(
        async () => {
          await this.handleBlock(currentBlock, this.tokenSaleIface);
          currentBlock++;
        },
        {
          retries: 3,
          shouldRetry: isTimeOutError,
        }
      );
    }
  }

  private async fetchSaleContracts(headBlock: number): Promise<void> {
    const factoryContract = new Contract(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      deployments[this.config.CHAIN_ID][this.config.NETWORK].contracts[
        this.config.CONTRACT_NAME
      ].address,
      SwapFactoryContract.abi,
      this.provider
    );

    const filter = await factoryContract.filters.CreatedSaleContract();
    let events: ethers.Event[] = [];
    let currentBlock = this.config.FACTORY_DEPLOYMENT_BLOCK;
    let toBlock =
      currentBlock + 100 < headBlock ? currentBlock + 100 : headBlock;
    let run = true;
    while (run) {
      await retry(async () => {
        logger.info(
          { fromBlock: currentBlock, toBlock, headBlock },
          "Fetching CreatedSaleContract events"
        );
        const evnts = await factoryContract.queryFilter(
          filter,
          currentBlock,
          toBlock
        );
        events = [...events, ...evnts];
        if (toBlock === headBlock) {
          run = false;
        }
        currentBlock += 100;
        toBlock = toBlock + 100 < headBlock ? toBlock + 100 : headBlock;
      });
    }
    // will be used for mintQueue check
    this.saleContractAddresses = events.map((event) => event.address);
  }

  private async handleBlock(
    currentBlock: number,
    tokenSaleIface: ethers.utils.Interface
  ): Promise<void> {
    const block = await this.provider.getBlock(currentBlock);

    block?.transactions.forEach(async (transaction) => {
      logger.info(`Handle block(${currentBlock}) transaction: ${transaction}`);

      const trans = await this.provider.getTransactionReceipt(transaction);

      if (trans?.logs.length) {
        trans.logs.forEach(async (log) => {
          try {
            const parsedEvent = await tokenSaleIface.parseLog(log);
            logger.info("Handle event", parsedEvent);
            // TODO
            // check if you should add job into mintQueue (eventName, address, transaction)
          } catch (err) {
            if (err.reason !== "no matching event") {
              throw new Error(err);
            }
          }
        });
      }
    });
  }
}
