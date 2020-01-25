import { ethers } from "ethers";
import { bigInt } from "snarkjs";

import {
  wallet,
  rollUpDef,
  deployCircomLib,
  deployHasher,
  deployMerkleTree,
  provider
} from "./common";

import { genPrivateKey, genPublicKey } from "../../operator/src/utils/crypto";
import { toWei, toWeiHex } from "../../operator/src/utils/helpers";

describe("Rollup.sol", () => {
  let circomLibContract;
  let hasherContract;
  let balanceTreeContract;
  let rollUpContract;

  const depth = 4;
  const zeroValue = bigInt(0);

  beforeAll(async () => {
    circomLibContract = await deployCircomLib();
    hasherContract = await deployHasher(circomLibContract.address);
  });

  beforeEach(async () => {
    try {
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

  it("Deposit, Withdraw, Events", async () => {
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
      value: toWeiHex(1.25)
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
    expect(bigInt(userData[3].toString())).toEqual(toWei(1.25));

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

    // Filter for events
    const depositEventFilter = rollUpContract.filters.Deposit();
    depositEventFilter.fromBlock = 0;
    depositEventFilter.toBlock = "latest";

    const depositLogsRaw = await provider.getLogs(depositEventFilter);
    const depositLogs = depositLogsRaw.map(x =>
      rollUpContract.interface.parseLog(x)
    );

    expect(depositLogs.length).toEqual(1);
    const depositLog = depositLogs[0];
    expect(depositLog.values.balanceTreeIndex.toString()).toEqual(
      bigInt(0).toString()
    );
    expect(depositLog.values.publicKeyX.toString()).toEqual(pub[0].toString());
    expect(depositLog.values.publicKeyY.toString()).toEqual(pub[1].toString());
    expect(depositLog.values.balance.toString()).toEqual(
      toWei(1.25).toString()
    );
    expect(depositLog.values.nonce.toString()).toEqual(bigInt(0).toString());

    // Withdraw events
    const withdrawEventFilter = rollUpContract.filters.Withdraw();
    withdrawEventFilter.fromBlock = 0;
    withdrawEventFilter.toBlock = "latest";

    const withdrawLogsRaw = await provider.getLogs(withdrawEventFilter);
    const withdrawLogs = withdrawLogsRaw.map(x =>
      rollUpContract.interface.parseLog(x)
    );

    // Make sure there's only one withdraw event
    expect(withdrawLogs.length).toEqual(1);
    const withdrawLog = withdrawLogs[0];
    expect(withdrawLog.values.balanceTreeIndex.toString()).toEqual(
      bigInt(0).toString()
    );
    expect(withdrawLog.values.publicKeyX.toString()).toEqual(pub[0].toString());
    expect(withdrawLog.values.publicKeyY.toString()).toEqual(pub[1].toString());
    expect(withdrawLog.values.balance.toString()).toEqual(bigInt(0).toString());
    expect(withdrawLog.values.nonce.toString()).toEqual(bigInt(0).toString());
  });

  it("Multiple Withdraws", async () => {
    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);

    await rollUpContract.deposit(pubA[0].toString(), pubA[1].toString(), {
      value: toWeiHex(1.0)
    });

    await rollUpContract.withdraw(
      pubA[0].toString(),
      pubA[1].toString(),
      toWei(0.3).toString()
    );

    await rollUpContract.withdraw(
      pubA[0].toString(),
      pubA[1].toString(),
      toWei(0.3).toString()
    );

    await rollUpContract.withdraw(
      pubA[0].toString(),
      pubA[1].toString(),
      toWei(0.3).toString()
    );

    await rollUpContract.withdraw(
      pubA[0].toString(),
      pubA[1].toString(),
      toWei(0.1).toString()
    );
  });

  it("Multiple deposits", async () => {
    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);

    const privB = genPrivateKey();
    const pubB = genPublicKey(privB);

    // User A deposits 1 eth
    await rollUpContract.deposit(pubA[0].toString(), pubA[1].toString(), {
      value: toWeiHex(1.0)
    });

    // User B deposits 2 eth
    await rollUpContract.deposit(pubB[0].toString(), pubB[1].toString(), {
      value: toWeiHex(2.0)
    });

    // User A deposits 0.5 eth
    await rollUpContract.deposit(pubA[0].toString(), pubA[1].toString(), {
      value: toWeiHex(0.5)
    });

    // Get User A Data
    const userAData = await rollUpContract.getUserData(
      pubA[0].toString(),
      pubA[1].toString()
    );

    // Expect balance
    expect(bigInt(userAData[3].toString())).toEqual(toWei(1.5));

    // Get user data
    const userBData = await rollUpContract.getUserData(
      pubB[0].toString(),
      pubB[1].toString()
    );

    // Leaf Index
    expect(userBData[0].toString()).toEqual(bigInt(1).toString());

    // Public Key
    expect(userBData[1].toString()).toEqual(pubB[0].toString());
    expect(userBData[2].toString()).toEqual(pubB[1].toString());

    // Balance
    expect(bigInt(userBData[3].toString())).toEqual(toWei(2.0));

    // Nonce
    expect(userBData[4].toString()).toEqual(bigInt(0).toString());
  });

  it("Withdraws > balance, should fail", async () => {
    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);

    // Deposit 1 Eth
    await rollUpContract.deposit(pubA[0].toString(), pubA[1].toString(), {
      value: toWeiHex(1.0)
    });

    // Tries to withdraw 1.01 Eth
    const failingAsyncTest = async () => {
      await rollUpContract.withdraw(
        pubA[0].toString(),
        pubA[1].toString(),
        toWei(1.01).toString()
      );
    };
    await expect(failingAsyncTest()).rejects.toThrow(
      "Withdraw amount is more than remaining balance"
    );

    await rollUpContract.withdraw(
      pubA[0].toString(),
      pubA[1].toString(),
      toWei(1.0).toString()
    );
  });
});
