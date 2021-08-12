import { expect } from "chai";

import { logger } from "../../src/services/logger";

import { app } from "./app-setup";

describe("Blocks e2e test", function () {
  beforeEach(async function () {
    logger.level = "silent";
  });

  afterEach(async function () {
    logger.level = "silent";
  });

  it("Should successfully query database", async function () {
    const res = await app().instance.inject({
      method: "GET",
      path: "/blocks",
    });
    
    expect(res.json()).not.to.be.undefined;
    expect(res.json()).not.to.be.equal(null);
    expect(res.json().items).to.be.deep.equal([]);
  });
});
