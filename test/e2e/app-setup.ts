import { Indexer } from "../../src/moonbeam_indexer";
let instance: Indexer;
let indexer: Indexer;
export const app = (): Indexer => instance;

before(async () => {
  indexer = new Indexer();
  await indexer.init();
  instance = indexer;
});

after(async () => {
  await indexer?.stop();
});
