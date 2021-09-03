import { Job, Processor } from "bullmq";
import { expect } from "chai";
import sinon from "sinon";
import { SinonStubbedInstance } from "sinon";

import { executeClaim } from "../../../src/commands/claimExecutor";
import { ClaimStatus } from "../../../src/entities";
import { ClaimRepository } from "../../../src/repositories/ClaimRepository";
import { logger } from "../../../src/services/logger";
import { ClaimData } from "../../../src/services/queue";
import { StatemintWallet } from "../../../src/services/statemint";

describe("Execute claim function", function () {
  let claimProcessor: Processor<ClaimData>;
  let walletStub: SinonStubbedInstance<StatemintWallet>;
  let claimRepositoryStub: SinonStubbedInstance<ClaimRepository>;

  before(function () {
    logger.level = "silent";
  });

  beforeEach(function () {
    walletStub = sinon.createStubInstance(StatemintWallet);
    claimRepositoryStub = sinon.createStubInstance(ClaimRepository);

    claimProcessor = executeClaim(
      walletStub as unknown as StatemintWallet,
      claimRepositoryStub as unknown as ClaimRepository
    );
    claimRepositoryStub.createClaim.resolves();
    walletStub.transferFrom.resolves();
  });

  afterEach(function () {
    sinon.restore();
  });

  it("Inserts successful claim and transfer tokens if claim valid", async function () {
    await claimProcessor({
      data: {
        claimTxHash: "hash",
        saleContractId: 1,
        amount: "1000",
        receiver: "address",
      },
    } as Job);

    expect(claimRepositoryStub.createClaim.callCount).to.be.deep.equal(1);
    expect(claimRepositoryStub.createClaim.args[0][0].status).to.be.deep.equal(
      ClaimStatus.SUCCESSFUL
    );
    expect(claimRepositoryStub.updateClaimStatus.callCount).to.be.deep.equal(0);
    expect(walletStub.transferFrom.callCount).to.be.deep.equal(1);
  });

  it("Does not insert claim and does not transfer tokens if claim invalid", async function () {
    claimRepositoryStub.createClaim.onFirstCall().throws();

    await claimProcessor({
      data: {
        claimTxHash: "hash",
        saleContractId: 1,
        amount: "1000",
        receiver: "address",
      },
    } as Job);

    expect(claimRepositoryStub.createClaim.callCount).to.be.deep.equal(1);
    expect(walletStub.transferFrom.callCount).to.be.deep.equal(0);
    expect(claimRepositoryStub.updateClaimStatus.callCount).to.be.deep.equal(0);
  });

  it("Inserts successful claim and updates status to failed if transfer fails", async function () {
    walletStub.transferFrom.throws();
    claimRepositoryStub.createClaim.resolves();

    await claimProcessor({
      data: {
        claimTxHash: "hash",
        saleContractId: 1,
        amount: "1000",
        receiver: "address",
      },
    } as Job);

    expect(claimRepositoryStub.createClaim.callCount).to.be.deep.equal(1);
    expect(claimRepositoryStub.createClaim.args[0][0].status).to.be.deep.equal(
      ClaimStatus.SUCCESSFUL
    );
    expect(walletStub.transferFrom.callCount).to.be.deep.equal(1);
    expect(claimRepositoryStub.updateClaimStatus.callCount).to.be.deep.equal(1);
  });
});
