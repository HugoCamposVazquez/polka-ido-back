import { paginate, Pagination } from "nestjs-typeorm-paginate";
import { EntityRepository, Repository } from "typeorm";

import { Block } from "../entities";

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

  public async createBlocks(
    blocks: {
      blockTime: number;
      blockNumber: number;
    }[]
  ): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .insert()
      .into(Block)
      .values(blocks)
      .execute();
  }

  public async getLatestBlock(): Promise<{ blockNumber: number } | undefined> {
    return await this.manager
      .createQueryBuilder<Block>(Block, "block")
      .select("MAX(block.blockNumber)", "blockNumber")
      .getRawOne();
  }
}
