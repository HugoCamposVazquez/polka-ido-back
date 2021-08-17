import { paginate, Pagination } from "nestjs-typeorm-paginate";
import { EntityRepository, Repository } from "typeorm";

import { Block } from "../entities";

type BlockIndex = {
  blockHash: string;
  chainId: number;
  blockTime: Date;
  blockNumber: number;
};

@EntityRepository(Block)
export class BlockRepository extends Repository<Block> {
  public async getAll(
    page = 1,
    route: string,
    limit = 10
  ): Promise<Pagination<Block>> {
    return await paginate(this, {
      page: page,
      route: route,
      limit: limit,
    });
  }

  public async insertBlock(block: BlockIndex): Promise<Block> {
    const blockInstance = await this.create(block);
    return await this.save(blockInstance);
  }

  public async getLatestBlock(): Promise<{ blockNumber: number } | undefined> {
    return await this.manager
      .createQueryBuilder<Block>(Block, "block")
      .select("MAX(block.blockNumber)", "blockNumber")
      .execute();
  }
}
