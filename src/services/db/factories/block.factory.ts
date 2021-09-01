import { define } from "typeorm-seeding";

import { Block } from "../../../entities";

define(Block, (faker) => {
  const block = new Block();
  block.blockNumber = faker.datatype.number({
    min: 400000,
    max: 500000,
  });
  return block;
});
