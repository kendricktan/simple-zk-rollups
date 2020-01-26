import { ethers } from "ethers";
import { bigInt } from "snarkjs";

import {
  wallet,
  rollUpDef,
  deployCircomLib,
  deployHasher,
  deployMerkleTree,
  deployWithdrawVerifier,
  deployTxVerifier,
  provider
} from "./common";

import { genWithdrawVerifierProof } from "../../operator/src/snarks/withdraw";
import {
  genPrivateKey,
  genPublicKey,
  formatPrivKeyForBabyJub,
  multiHash
} from "../../operator/src/utils/crypto";
import { toWei, toWeiHex } from "../../operator/src/utils/helpers";

describe("Rollup.sol", () => {
  let circomLibContract;
  let hasherContract;
  let withdrawVerifierContract;
  let txVerifierContract;
  let balanceTreeContract;
  let rollUpContract;

  const depth = 4;
  const zeroValue = bigInt(0);

  beforeAll(async done => {
    circomLibContract = await deployCircomLib();
    hasherContract = await deployHasher(circomLibContract.address);
    withdrawVerifierContract = await deployWithdrawVerifier();
    txVerifierContract = await deployTxVerifier();

    done();
  });

  beforeEach(async done => {
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
        hasherContract.address,
        balanceTreeContract.address,
        withdrawVerifierContract.address,
        txVerifierContract.address
      );
      await rollUpContract.deployed();
      await balanceTreeContract.whitelistAddress(rollUpContract.address);
    } catch (e) {
      console.log(e);
    }

    done();
  });

  it("Deposit, Withdraw, Events", async done => {
    const priv = genPrivateKey();
    const pub = genPublicKey(priv);
    const pubHash = multiHash(pub);

    // User is not registered
    const isNotRegistered = await rollUpContract.isPublicKeyRegistered(
      pub[0].toString(),
      pub[1].toString()
    );
    expect(isNotRegistered).toEqual(false);

    // User is registered once deposited
    await rollUpContract.deposit(pub[0].toString(), pub[1].toString(), {
      value: toWeiHex(1.25)
    });

    const isPublicKeyRegistered = await rollUpContract.isPublicKeyRegistered(
      pub[0].toString(),
      pub[1].toString()
    );
    expect(isPublicKeyRegistered).toEqual(true);

    const userData = await rollUpContract.getUserData(pubHash.toString());

    expect(userData[0].toString()).toEqual(bigInt(0).toString());
    expect(userData[1].toString()).toEqual(pub[0].toString());
    expect(userData[2].toString()).toEqual(pub[1].toString());
    expect(bigInt(userData[3].toString())).toEqual(toWei(1.25));
    expect(userData[4].toString()).toEqual(bigInt(0).toString());

    // Withdraw
    const preWithdrawBalance = await wallet.getBalance();
    const { solidityProof } = await genWithdrawVerifierProof({
      privateKey: formatPrivKeyForBabyJub(priv),
      nullifier: genPrivateKey()
    });
    await rollUpContract.withdrawAll(
      solidityProof.a,
      solidityProof.b,
      solidityProof.c,
      solidityProof.inputs
    );
    const postWithdrawBalance = await wallet.getBalance();

    expect(bigInt(postWithdrawBalance.toString())).toBeGreaterThan(
      bigInt(preWithdrawBalance.toString())
    );

    const newUserData = await rollUpContract.getUserData(pubHash.toString());

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

    done();
  });

  it("Multiple Withdraws", async done => {
    const priv = genPrivateKey();
    const pub = genPublicKey(priv);

    await rollUpContract.deposit(pub[0].toString(), pub[1].toString(), {
      value: toWeiHex(1.0)
    });

    const proof1 = await genWithdrawVerifierProof({
      privateKey: formatPrivKeyForBabyJub(priv),
      nullifier: genPrivateKey()
    });

    await rollUpContract.withdraw(
      toWei(0.3).toString(),
      proof1.solidityProof.a,
      proof1.solidityProof.b,
      proof1.solidityProof.c,
      proof1.solidityProof.inputs
    );

    // Now try and change nullifier (should fail)
    const failingWithdraw1 = async () => {
      proof1.solidityProof.inputs[2] = genPrivateKey().toString();

      await rollUpContract.withdraw(
        toWei(0.3).toString(),
        proof1.solidityProof.a,
        proof1.solidityProof.b,
        proof1.solidityProof.c,
        proof1.solidityProof.inputs
      );
    };
    expect(failingWithdraw1()).rejects.toThrow(
      "Unauthorized to withdraw funds"
    );

    const proof2 = await genWithdrawVerifierProof({
      privateKey: formatPrivKeyForBabyJub(priv),
      nullifier: genPrivateKey()
    });

    await rollUpContract.withdraw(
      toWei(0.3).toString(),
      proof2.solidityProof.a,
      proof2.solidityProof.b,
      proof2.solidityProof.c,
      proof2.solidityProof.inputs
    );

    // Try and reuse nullifier
    const failingWithdraw2 = async () => {
      await rollUpContract.withdraw(
        toWei(0.3).toString(),
        proof2.solidityProof.a,
        proof2.solidityProof.b,
        proof2.solidityProof.c,
        proof2.solidityProof.inputs
      );
    };
    expect(failingWithdraw2()).rejects.toThrow("Nullifier has been used");

    const proof3 = await genWithdrawVerifierProof({
      privateKey: formatPrivKeyForBabyJub(priv),
      nullifier: genPrivateKey()
    });

    await rollUpContract.withdraw(
      toWei(0.3).toString(),
      proof3.solidityProof.a,
      proof3.solidityProof.b,
      proof3.solidityProof.c,
      proof3.solidityProof.inputs
    );

    done();
  });

  it("Multiple deposits", async done => {
    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);
    const pubAHash = multiHash(pubA);

    const privB = genPrivateKey();
    const pubB = genPublicKey(privB);
    const pubBHash = multiHash(pubB);

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
    const userAData = await rollUpContract.getUserData(pubAHash.toString());

    // Expect balance
    expect(bigInt(userAData[3].toString())).toEqual(toWei(1.5));

    // Get user data
    const userBData = await rollUpContract.getUserData(pubBHash.toString());

    expect(userBData[0].toString()).toEqual(bigInt(1).toString()); // leaf index
    expect(userBData[1].toString()).toEqual(pubB[0].toString());
    expect(userBData[2].toString()).toEqual(pubB[1].toString());
    expect(bigInt(userBData[3].toString())).toEqual(toWei(2.0)); // balance
    expect(userBData[4].toString()).toEqual(bigInt(0).toString()); // nonce

    done();
  });

  it("Withdraws > balance, should fail", async done => {
    const priv = genPrivateKey();
    const pub = genPublicKey(priv);

    const { solidityProof } = await genWithdrawVerifierProof({
      privateKey: formatPrivKeyForBabyJub(priv),
      nullifier: genPrivateKey()
    });

    // Deposit 1 Eth
    await rollUpContract.deposit(pub[0].toString(), pub[1].toString(), {
      value: toWeiHex(1.0)
    });

    // Tries to withdraw 1.01 Eth
    const failingAsyncTest = async () => {
      await rollUpContract.withdraw(
        toWei(1.01).toString(),
        solidityProof.a,
        solidityProof.b,
        solidityProof.c,
        solidityProof.inputs
      );
    };
    await expect(failingAsyncTest()).rejects.toThrow(
      "Withdraw amount is more than remaining balance"
    );

    await rollUpContract.withdraw(
      toWei(0.9).toString(),
      solidityProof.a,
      solidityProof.b,
      solidityProof.c,
      solidityProof.inputs
    );

    done();
  });
});
