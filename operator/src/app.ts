import { initPg, initMerkleTree } from "./db/postgres";
import { bigInt } from "snarkjs";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as config from "../../zk-rollups.config";

// Prepends timestamp to console.log
require("log-timestamp");

const port = 3000;
const balanceTreeName = "balanceTree";

const app = express();
app.use(bodyParser.json());

// Pub/Sub events

// Routes

// Entry point
export const startApp = async () => {
  console.log("Connecting to postgres....");
  await initPg();
  console.log("Successfully connected to postgres!");

  console.log("Initializing postgres models....");
  await initMerkleTree(
    balanceTreeName,
    config.balanceTree.depth,
    bigInt(config.balanceTree.zeroValue)
  );
  console.log("Successfully initialized postgres models!");

  app.listen(port, async () => {
    console.log(`Operator running at 127.0.0.1:${port.toString()}`);
  });
};

// Starts app if this is the main module
if (typeof require !== "undefined" && require.main === module) {
  startApp();
}

export default app;
