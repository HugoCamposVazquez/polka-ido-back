import nodeCleanup from "node-cleanup";

import { App } from "./App";
import { Indexer } from "./moonbeam_indexer";
import { BlockIndexer } from "./services/block-indexer";
if (process.env.APP === "api") {
  App.init().then((app) => {
    nodeCleanup(function (exitCode, signal) {
      app.stop(signal as string);
      nodeCleanup.uninstall();
      return false;
    });

    app.start();
  });
} else if (process.env.APP === "indexer") {
  const app = new Indexer();
  app.init().then(async () => {
    nodeCleanup(function (exitCode, signal) {
      app.stop(signal as string);
      nodeCleanup.uninstall();
      return false;
    });
    app.start();
  });
}
