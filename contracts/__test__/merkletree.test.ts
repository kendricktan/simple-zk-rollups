import { ethers } from "ethers";
import { bigInt } from "snarkjs";

import { ganacheConfig } from "./ganache-config";
import { createMerkleTree } from "../../operator/src/utils/merkletree";
import { multiHash, genPrivateKey } from "../../operator/src/utils/crypto";

// Workaround to link external libraries
// https://github.com/ethers-io/ethers.js/issues/195#issuecomment-396350174
const linkLibraries = (
  bytecode: string,
  libName: string,
  libAddress: string
): string => {
  let symbol = "__" + libName + "_".repeat(40 - libName.length - 2);
  return bytecode.split(symbol).join(libAddress.toLowerCase().substr(2));
};

const provider = new ethers.providers.JsonRpcProvider();
const privateKey = ganacheConfig.privateKey;

const wallet = new ethers.Wallet(privateKey, provider);

const circomLibDef = require("../build/contracts/CircomLib.json");
const hasherDef = require("../build/contracts/Hasher.json");
const merkletreeDef = require("../build/contracts/MerkleTree.json");

describe("MerkleTree.sol", () => {
  let circomLibContract;
  let hasherContract;
  let merkleTreeContract;

  const depth = 4;
  const zeroValue = bigInt(0);

  beforeAll(async () => {
    //@ts-ignore
    const circomLibFactory = new ethers.ContractFactory(
      circomLibDef.abi,
      circomLibDef.bytecode,
      wallet
    );

    circomLibContract = await circomLibFactory.deploy();
    await circomLibContract.deployed();

    const hasherFactory = new ethers.ContractFactory(
      hasherDef.abi,
      linkLibraries(hasherDef.bytecode, "CircomLib", circomLibContract.address),
      wallet
    );
    hasherContract = await hasherFactory.deploy();
    await hasherContract.deployed();
  });

  beforeEach(async () => {
    const merkleTreeFactory = new ethers.ContractFactory(
      merkletreeDef.abi,
      merkletreeDef.bytecode,
      wallet
    );
    merkleTreeContract = await merkleTreeFactory.deploy(
      depth,
      zeroValue.toString(),
      hasherContract.address
    );
    await merkleTreeContract.deployed();
    await merkleTreeContract.whitelistAddress(wallet.address);
  });

  it("Insert", async () => {
    const leaf = multiHash([bigInt(1), bigInt(2)]);

    const m = createMerkleTree(depth, zeroValue);
    m.insert_(leaf);

    await merkleTreeContract.insert(leaf.toString());
    const root = await merkleTreeContract.getRoot();

    expect(m.root.toString()).toEqual(root.toString());
  });

  it("Update", async () => {
    const leaves = [0, 0, 0, 0].map(() =>
      multiHash([genPrivateKey(), genPrivateKey()])
    );

    const m = createMerkleTree(depth, zeroValue);

    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];

      m.insert_(leaf);
      await merkleTreeContract.insert(leaf.toString());

      const root = await merkleTreeContract.getRoot();
      expect(m.root.toString()).toEqual(root.toString());
    }

    const newLeafIndex = 2;
    const newLeaf = multiHash([genPrivateKey()]);

    m.update_(newLeafIndex, newLeaf);
    await merkleTreeContract.update(
      newLeafIndex.toString(),
      newLeaf.toString()
    );

    const root = await merkleTreeContract.getRoot();
    expect(m.root.toString()).toEqual(root.toString());
  });
});
