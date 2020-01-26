import { ethers } from "ethers";

export const ganacheConfig = {
  privateKey:
    "0x94a9f52a9ef7933f3865a91766cb5e12d25f62d6aecf1d768508d95526bfee29"
};

// Workaround to link external libraries
// https://github.com/ethers-io/ethers.js/issues/195#issuecomment-396350174
export const linkLibraries = (
  bytecode: string,
  libName: string,
  libAddress: string
): string => {
  let symbol = "__" + libName + "_".repeat(40 - libName.length - 2);
  return bytecode.split(symbol).join(libAddress.toLowerCase().substr(2));
};

export const provider = new ethers.providers.JsonRpcProvider();
export const wallet = new ethers.Wallet(ganacheConfig.privateKey, provider);

export const circomLibDef = require("../build/contracts/CircomLib.json");
export const hasherDef = require("../build/contracts/Hasher.json");
export const merkletreeDef = require("../build/contracts/MerkleTree.json");
export const withdrawVerifierDef = require("../build/contracts/WithdrawVerifier.json");
export const txVerifierDef = require("../build/contracts/TxVerifier.json");
export const rollUpDef = require("../build/contracts/RollUp.json");

export const deployCircomLib = async (): Promise<ethers.Contract> => {
  const circomLibFactory = new ethers.ContractFactory(
    circomLibDef.abi,
    circomLibDef.bytecode,
    wallet
  );

  const circomLibContract = await circomLibFactory.deploy();
  await circomLibContract.deployed();

  return circomLibContract;
};

export const deployHasher = async (
  circomLibAddress: string
): Promise<ethers.Contract> => {
  const hasherFactory = new ethers.ContractFactory(
    hasherDef.abi,
    linkLibraries(hasherDef.bytecode, "CircomLib", circomLibAddress),
    wallet
  );
  const hasherContract = await hasherFactory.deploy();
  await hasherContract.deployed();

  return hasherContract;
};

export const deployWithdrawVerifier = async (): Promise<ethers.Contract> => {
  const withdrawVerifierFactory = new ethers.ContractFactory(
    withdrawVerifierDef.abi,
    withdrawVerifierDef.bytecode,
    wallet
  );

  const withdrawVerifierContract = await withdrawVerifierFactory.deploy();
  await withdrawVerifierContract.deployed();

  return withdrawVerifierContract;
};

export const deployTxVerifier = async (): Promise<ethers.Contract> => {
  const txVerifierFactory = new ethers.ContractFactory(
    txVerifierDef.abi,
    txVerifierDef.bytecode,
    wallet
  );

  const txVerifierContract = await txVerifierFactory.deploy();
  await txVerifierContract.deployed();

  return txVerifierContract;
};

export const deployMerkleTree = async (
  depth: number,
  zeroValue: number,
  hasherAddress: string
): Promise<ethers.Contract> => {
  const merkleTreeFactory = new ethers.ContractFactory(
    merkletreeDef.abi,
    merkletreeDef.bytecode,
    wallet
  );
  const merkleTreeContract = await merkleTreeFactory.deploy(
    depth.toString(),
    zeroValue.toString(),
    hasherAddress
  );

  await merkleTreeContract.deployed();
  await merkleTreeContract.whitelistAddress(wallet.address);

  return merkleTreeContract;
};

export const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
