import { ethers } from "ethers";
import { bigInt } from "snarkjs";

import {
  wallet,
  rollUpDef,
  deployCircomLib,
  deployHasher,
  deployMerkleTree,
  deployWithdrawVerifier,
  deployTxVerifier
} from "../../contracts/__tests__/common";

import { genTxVerifierProof } from "../src/snarks/tx";

import { genPrivateKey, genPublicKey, multiHash } from "../src/utils/crypto";
import { sign } from "../src/utils/crypto";
import {
  toWei,
  toWeiHex,
  formatTx,
  hashBalanceTreeLeaf,
  copyObject,
  stringifyBigInts
} from "../src/utils/helpers";
import * as config from "../../zk-rollups.config";
import { createMerkleTree } from "../src/utils/merkletree";
import {
  Signature,
  Transaction,
  BalanceTreeLeafData
} from "../src/types/models";

describe("OperatorLogic.ts", () => {
  it("Zk Roll Ups", async done => {
    // Deploy contracts
    console.log("Deploying CircomLib contract");
    const circomLibContract = await deployCircomLib();
    console.log("Deploying Hasher contract");
    const hasherContract = await deployHasher(circomLibContract.address);
    console.log("Deploying WithdrawVerifier contract");
    const withdrawVerifierContract = await deployWithdrawVerifier();
    console.log("Deploying TxVerifier contract");
    const txVerifierContract = await deployTxVerifier();
    console.log("Deploying BalanceTree contract");
    const balanceTreeContract = await deployMerkleTree(
      config.balanceTree.depth,
      parseInt(config.balanceTree.zeroValue.toString()),
      hasherContract.address
    );
    const rollUpFactory = new ethers.ContractFactory(
      rollUpDef.abi,
      rollUpDef.bytecode,
      wallet
    );
    console.log("Deploying RollUp contract");
    const rollUpContract = await rollUpFactory.deploy(
      hasherContract.address,
      balanceTreeContract.address,
      withdrawVerifierContract.address,
      txVerifierContract.address
    );
    await rollUpContract.deployed();
    await balanceTreeContract.whitelistAddress(rollUpContract.address);
    console.log("Deployed contracts!");

    // Merkle Tree (to faciliate proof generation)
    const m = createMerkleTree(
      config.balanceTree.depth,
      bigInt(config.balanceTree.zeroValue)
    );

    // Create 2 users
    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);
    const indexA = 0;

    const privB = genPrivateKey();
    const pubB = genPublicKey(privB);
    const indexB = 1;

    // User A Deposits 1.0 ETH (index 0)
    console.log("Depositing funds to contract...");
    await rollUpContract.deposit(pubA[0].toString(), pubA[1].toString(), {
      value: toWeiHex(1.0)
    });
    const leafDataA: BalanceTreeLeafData = {
      publicKey: pubA,
      nonce: 0,
      balance: toWei(1.0)
    };
    m.insert_(hashBalanceTreeLeaf(leafDataA), leafDataA);

    // User B Deposits 1.0 ETH (index 1)
    await rollUpContract.deposit(pubB[0].toString(), pubB[1].toString(), {
      value: toWeiHex(1.0)
    });
    const leafDataB: BalanceTreeLeafData = {
      publicKey: pubB,
      nonce: 0,
      balance: toWei(1.0)
    };
    m.insert_(hashBalanceTreeLeaf(leafDataB), leafDataB);

    //** Transaction 1 */
    // Creates tx 1 and submits to operator
    console.log("Creating transaction data...");
    const tx1PreSign: Transaction = {
      from: indexA,
      to: indexB,
      amount: toWei(0.1),
      nonce: 1,
      fee: toWei(0.01)
    };
    const signatureTx1: Signature = sign(privA, formatTx(tx1PreSign));
    const tx1: Transaction = Object.assign({}, tx1PreSign, {
      signature: signatureTx1
    });

    // Operator handles new leaf data
    const m1 = m;
    const sender1Paths = m1.getUpdatePath(tx1.from);
    const recipient1Paths = m1.getUpdatePath(tx1.to);

    // Gets sender and intermediateBalanceTreeLeafData1 (ibtld1)
    const recipient1: BalanceTreeLeafData = copyObject(m1.leavesRaw[tx1.to]);
    const sender1: BalanceTreeLeafData = copyObject(m1.leavesRaw[tx1.from]);
    const ibtld1: BalanceTreeLeafData = {
      publicKey: sender1.publicKey,
      balance: sender1.balance.sub(tx1.amount).sub(tx1.fee),
      nonce: sender1.nonce + 1
    };
    const m1Intermediate = m1.update(
      tx1.from,
      hashBalanceTreeLeaf(ibtld1),
      ibtld1
    );
    const m1IntermediatePaths = m1Intermediate.getUpdatePath(tx1.to);

    // Constructs final leaf data and finalBalanceTreeLeafData1 (fbtld1)
    const fbtld1Recipient: BalanceTreeLeafData = copyObject(
      m1Intermediate.leavesRaw[tx1.to]
    );
    const fbtld1: BalanceTreeLeafData = {
      publicKey: fbtld1Recipient.publicKey,
      balance: fbtld1Recipient.balance.add(tx1.amount),
      nonce: fbtld1Recipient.nonce
    };
    const m1Final = m1Intermediate.update(
      tx1.to,
      hashBalanceTreeLeaf(fbtld1),
      fbtld1
    );

    //** Transaction 2 (does the same thing as transaction 1) */
    const tx2PreSign: Transaction = {
      from: indexA,
      to: indexB,
      amount: toWei(0.3),
      nonce: 2,
      fee: toWei(0.02)
    };
    const signatureTx2: Signature = sign(privA, formatTx(tx2PreSign));
    const tx2: Transaction = Object.assign({}, tx2PreSign, {
      signature: signatureTx2
    });

    const m2 = m1Final;
    const sender2Paths = m2.getUpdatePath(tx2.from);
    const recipient2Paths = m2.getUpdatePath(tx2.to);

    const sender2: BalanceTreeLeafData = copyObject(m2.leavesRaw[tx2.from]);
    const recipient2: BalanceTreeLeafData = copyObject(m2.leavesRaw[tx2.to]);
    const ibtld2: BalanceTreeLeafData = {
      publicKey: sender2.publicKey,
      balance: sender2.balance.sub(tx2.amount).sub(tx2.fee),
      nonce: sender2.nonce + 1
    };
    const m2Intermediate = m2.update(
      tx2.from,
      hashBalanceTreeLeaf(ibtld2),
      ibtld2
    );
    const m2IntermediatePaths = m2Intermediate.getUpdatePath(tx2.to);

    // const fbtld2: BalanceTreeLeafData = {
    //   publicKey: recipient2.publicKey,
    //   balance: recipient2.balance.add(tx2.amount),
    //   nonce: recipient2.nonce
    // };
    // const m2Final = m2Intermediate.update(
    //   tx2.to,
    //   hashBalanceTreeLeaf(fbtld2),
    //   fbtld2
    // );

    // We have now processed the transactions, time to create a proof and upload it
    //@ts-ignore
    const circuitInputs = stringifyBigInts({
      balanceTreeRoot: [m1.root, m2.root],
      txData: [formatTx(tx1), formatTx(tx2)],
      txSenderPublicKey: [sender1.publicKey, sender2.publicKey],
      txSenderBalance: [sender1.balance, sender2.balance],
      txSenderNonce: [sender1.nonce, sender2.nonce],
      txSenderPathElements: [
        sender1Paths.pathElements,
        sender2Paths.pathElements
      ],
      txRecipientPublicKey: [recipient1.publicKey, recipient2.publicKey],
      txRecipientBalance: [recipient1.balance, recipient2.balance],
      txRecipientNonce: [recipient1.nonce, recipient2.nonce],
      txRecipientPathElements: [
        recipient1Paths.pathElements,
        recipient2Paths.pathElements
      ],
      intermediateBalanceTreeRoot: [m1Intermediate.root, m2Intermediate.root],
      intermediateBalanceTreePathElements: [
        m1IntermediatePaths.pathElements,
        m2IntermediatePaths.pathElements
      ]
    });

    // Generate proof
    const { solidityProof } = await genTxVerifierProof(circuitInputs);

    await rollUpContract.rollUp(
      solidityProof.a,
      solidityProof.b,
      solidityProof.c,
      solidityProof.inputs
    );

    // Get user data
    const userAData = await rollUpContract.getUserData(
      multiHash(pubA).toString()
    );

    const userBData = await rollUpContract.getUserData(
      multiHash(pubB).toString()
    );

    expect(userAData[4].toString()).toEqual((2).toString());
    expect(bigInt(userAData[3].toString())).toEqual(toWei(0.57));

    expect(bigInt(userBData[3].toString())).toEqual(toWei(1.4));

    // Get accurred fees
    const accuredFees = await rollUpContract.getAccuredFees();
    expect(accuredFees.toString()).toEqual(toWei(0.03).toString());

    done();
  });
});
