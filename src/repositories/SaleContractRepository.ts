import { paginate, Pagination } from "nestjs-typeorm-paginate";
import { EntityRepository, Repository } from "typeorm";

import { SaleContract } from "../entities";

type SaleContractData = {
  chainId: number;
  blockHash: string;
  id: string;
};
@EntityRepository(SaleContract)
export class SaleContractRepository extends Repository<SaleContract> {
  public async getAll(
    page = 1,
    route: string,
    limit = 10
  ): Promise<Pagination<SaleContract>> {
    return await paginate(this, {
      page: page,
      route: route,
      limit: limit,
    });
  }

  public async insertSaleContract(
    saleContract: SaleContractData
  ): Promise<SaleContract> {
    const saleContractInstance = await this.create(saleContract);
    return await this.save(saleContractInstance);
  }

  public async getAllAddresses(): Promise<string[]> {
    const contracts = await this.find({ select: ["id"] });
    const addresses = contracts.map((contract) => contract.id.toLowerCase());
    return addresses;
  }
}
