const fs = require("fs");
const path = require("path");

const MerkleTree = artifacts.require("MerkleTree");
const RollUp = artifacts.require("RollUp");
const CircomLib = artifacts.require("CircomLib");
const Hasher = artifacts.require("Hasher");
const WithdrawVerifier = artifacts.require("WithdrawVerifier");
const TxVerifier = artifacts.require("TxVerifier");

const config = require("../../zk-rollups.config");

module.exports = async deployer => {
  // Link MiMC with the Hasher object
  await deployer.link(CircomLib, Hasher);

  // Deploy hasher
  const hasher = await deployer.deploy(Hasher);

  // Deploy merkle tree
  const balanceTree = await deployer.deploy(
    MerkleTree,
    config.balanceTree.depth.toString(),
    config.balanceTree.zeroValue.toString(),
    hasher.address
  );

  // Deploy withdraw verifier
  const withdrawVerifier = await deployer.deploy(WithdrawVerifier);
  const txVerifier = await deployer.deploy(TxVerifier);

  // Deploy RollUp
  const rollUp = await deployer.deploy(
    RollUp,
    hasher.address,
    balanceTree.address,
    withdrawVerifier.address,
    txVerifier.address
  );

  // Allow zk-rollups contract to call `insert` and `update` methods
  // on the MerkleTrees
  await balanceTree.whitelistAddress(rollUp.address);

  // Saves Deployed Addresses to a JSON file
  const data = JSON.stringify({
    balanceTreeAddress: balanceTree.address,
    rollUpAddress: rollUp.address,
    withdrawVerifierAddress: withdrawVerifier.address,
    txVerifierAddress: txVerifier.address
  });

  const buildDir = path.resolve(__dirname, "../build");
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
  }
  fs.writeFileSync(path.resolve(buildDir, "DeployedAddresses.json"), data);
};
