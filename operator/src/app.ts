import { bigInt } from "snarkjs";

import { initPg, initMerkleTree } from "./db/postgres";
import { initRedis } from "./db/redis";
import { getRollUpContract, getContractAddresses } from "./utils/env";
import { onEventUpdateMerkleTree } from "./routes/pubsub";
import { sendRoute } from "./routes/send";
import { userAddressRoute, userIndexRoute } from "./routes/users";

import * as express from "express";
import * as bodyParser from "body-parser";
import * as config from "../../zk-rollups.config";

// Prepends timestamp to console.log
require("log-timestamp");

const port = 3000;
const app = express();
const rollUpContract = getRollUpContract();

// Middleware
app.use(bodyParser.json());

// Routes
app.get("/contracts", async (_, res) => {
  res.send(getContractAddresses());
});

app.get("/users/index/:userIndex", userIndexRoute);
app.get("/users/address/:userAddress", userAddressRoute);
app.post("/send", sendRoute);

// Entry point
export const startApp = async () => {
  console.log("Connecting to postgres....");
  await initPg();
  console.log("Successfully connected to postgres!");

  console.log("Initializing postgres models....");
  await initMerkleTree(
    config.balanceTree.name,
    config.balanceTree.depth,
    bigInt(config.balanceTree.zeroValue)
  );
  console.log("Successfully initialized postgres models!");

  console.log("Connecting to redis....");
  await initRedis();
  console.log("Successfully connected to redis!");

  // Configure pub/sub events
  rollUpContract.addListener("Deposit", onEventUpdateMerkleTree("Deposit"));
  console.log(
    `Listening to [Deposit] events on contract ${rollUpContract.address}`
  );
  rollUpContract.addListener("Withdraw", onEventUpdateMerkleTree("Withdraw"));
  console.log(
    `Listening to [Withdraw] events on contract ${rollUpContract.address}`
  );

  app.listen(port, async () => {
    console.log(`Operator running at 127.0.0.1:${port.toString()}`);
  });
};

// Starts app if this is the main module
if (typeof require !== "undefined" && require.main === module) {
  startApp();
}

export default app;
