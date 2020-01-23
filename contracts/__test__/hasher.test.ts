import { ethers } from "ethers";

import { ganacheConfig } from "./ganache-config";
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

describe("Hasher.sol", () => {
  let circomLibContract;
  let hasherContract;

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

  it("hashMulti", async () => {
    const d = [genPrivateKey(), genPrivateKey()];

    const a = multiHash(d);
    const b = await hasherContract.hashMulti(
      d.map(x => x.toString()),
      0 // key
    );

    expect(a.toString()).toEqual(b.toString());
  });
});
