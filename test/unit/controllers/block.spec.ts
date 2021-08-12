import * as assert from "assert";

import { expect } from "chai";
import sinon, { SinonStubbedInstance } from "sinon";

import { App } from "../../../src/App";
import { BlockRepository } from "../../../src/repositories/BlockRepository";
import { logger } from "../../../src/services/logger";
import "../../../src/services/db/factories/block.factory";

describe("sample controller", function () {
  let app: App;
  let blockRepositoryStub: SinonStubbedInstance<BlockRepository>;

  beforeEach(async function () {
    logger.level = "silent";
    process.env.STATEMINT_MINTING_WALLET_MNEMONIC = "//alice";
    process.env.SWAP_FACTORY_ADDRESS =
      "0xe0daCCBFbf3EdBbbc8E768fa520c8C80Dd758D13";
    process.env.FACTORY_DEPLOYMENT_BLOCK = "408638";

    app = await App.init();
    blockRepositoryStub = sinon.createStubInstance(BlockRepository);
    app.instance.decorate("db", {
      getCustomRepository: () => blockRepositoryStub,
    });
    await app.instance.ready();
  });

  afterEach(async function () {
    logger.level = "silent";
    sinon.restore();
  });

  it("Should get paginated blocks", async function () {
    try {
      const data = {
        items: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 10,
          totalPages: 0,
          currentPage: 1,
        },
        links: {
          first: "/blocks?limit=10",
          previous: "",
          next: "",
          last: "",
        },
      };
      blockRepositoryStub.getAll.resolves(data);

      const res = await app.instance.inject({
        method: "GET",
        path: "/blocks",
      });
      expect(res.json()).to.be.deep.equal(data);
    } catch (e) {
      assert.fail(e);
    }
  });
});
