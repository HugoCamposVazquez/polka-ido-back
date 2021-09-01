import { Factory, Seeder } from "typeorm-seeding";

import { Block } from "../../../entities";

export class SampleSeed implements Seeder {
  public async run(factory: Factory): Promise<void> {
    await factory(Block)().seedMany(10);
  }
}
