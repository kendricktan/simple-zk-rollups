import { ethers } from "ethers";
import { bigInt } from "snarkjs";

import {
  wallet,
  rollUpDef,
  deployCircomLib,
  deployHasher,
  deployMerkleTree
} from "./common";

import { genPrivateKey, genPublicKey } from "../../operator/src/utils/crypto";
import { toWei } from "../../operator/src/utils/helpers";

describe("Rollup.sol", () => {
  let balanceTreeContract;
  let rollUpContract;

  const depth = 4;
  const zeroValue = bigInt(0);

  beforeEach(async () => {
    try {
      const circomLibContract = await deployCircomLib();
      const hasherContract = await deployHasher(circomLibContract.address);
      balanceTreeContract = await deployMerkleTree(
        depth,
        zeroValue,
        hasherContract.address
      );

      const rollUpFactory = new ethers.ContractFactory(
        rollUpDef.abi,
        rollUpDef.bytecode,
        wallet
      );
      rollUpContract = await rollUpFactory.deploy(
        balanceTreeContract.address,
        hasherContract.address
      );
      await rollUpContract.deployed();
      await balanceTreeContract.whitelistAddress(rollUpContract.address);
    } catch (e) {
      console.log(e);
    }
  });

  it("Deposit and then Withdraw", async () => {
    const priv = genPrivateKey();
    const pub = genPublicKey(priv);

    // User is not registered
    const isNotRegistered = await rollUpContract.isRegistered(
      pub[0].toString(),
      pub[1].toString()
    );
    expect(isNotRegistered).toEqual(false);

    // User is registered once deposited
    await rollUpContract.deposit(pub[0].toString(), pub[1].toString(), {
      //@ts-ignore
      value: "0x" + toWei(1.0).toString(16)
    });

    const isRegistered = await rollUpContract.isRegistered(
      pub[0].toString(),
      pub[1].toString()
    );
    expect(isRegistered).toEqual(true);

    const userData = await rollUpContract.getUserData(
      pub[0].toString(),
      pub[1].toString()
    );

    // Leaf Index
    expect(userData[0].toString()).toEqual(bigInt(0).toString());

    // Public Key
    expect(userData[1].toString()).toEqual(pub[0].toString());
    expect(userData[2].toString()).toEqual(pub[1].toString());

    // Balance
    expect(bigInt(userData[3].toString())).toBeGreaterThan(bigInt(0));

    // Nonce
    expect(userData[4].toString()).toEqual(bigInt(0).toString());

    // Withdraw
    const preWithdrawBalance = await wallet.getBalance();
    await rollUpContract.withdrawAll(pub[0].toString(), pub[1].toString());
    const postWithdrawBalance = await wallet.getBalance();

    expect(bigInt(postWithdrawBalance.toString())).toBeGreaterThan(
      bigInt(preWithdrawBalance.toString())
    );

    const newUserData = await rollUpContract.getUserData(
      pub[0].toString(),
      pub[1].toString()
    );

    expect(bigInt(newUserData[3].toString())).toEqual(bigInt(0));
  });

  it("Multiple Users, multiple deposits", async () => {
    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);

    const privB = genPrivateKey();
    const pubB = genPublicKey(privB);

    // User A deposits 1 eth
    await rollUpContract.deposit(pubA[0].toString(), pubA[1].toString(), {
      //@ts-ignore
      value: "0x" + toWei(1.0).toString(16)
    });

    // User B deposits 2 eth
    await rollUpContract.deposit(pubB[0].toString(), pubB[1].toString(), {
      //@ts-ignore
      value: "0x" + toWei(2.0).toString(16)
    });

    // User A deposits 0.5 eth
    await rollUpContract.deposit(pubA[0].toString(), pubA[1].toString(), {
      //@ts-ignore
      value: "0x" + toWei(0.5).toString(16)
    });

    // Get User A Data
    const userAData = await rollUpContract.getUserData(
      pubA[0].toString(),
      pubA[1].toString()
    );

    // Expect balance
    expect(bigInt(userAData[3].toString())).toEqual(toWei(1.5));
  });
});
