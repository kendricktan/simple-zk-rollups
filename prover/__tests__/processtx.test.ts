import * as path from "path";
import * as compiler from "circom";

import { Circuit, bigInt } from "snarkjs";
import { SnarkBigInt } from "../../operator/src/types/primitives";
import { Transaction } from "../../operator/src/types/models";
import {
  toWei,
  formatTx,
  stringifyBigInts
} from "../../operator/src/utils/helpers";
import {
  genPrivateKey,
  genPublicKey,
  sign,
  multiHash
} from "../../operator/src/utils/crypto";
import {
  createMerkleTree,
  MerkleTree
} from "../../operator/src/utils/merkletree";

describe("processtx.circom", () => {
  it("ProcessTx(4)", async () => {
    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "processtx_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    const userAIndex = 0;
    const userABalance = toWei(50);
    const userANonce = 1;
    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);

    const userBIndex = 1;
    const userBBalance = toWei(0);
    const userBNonce = 0;
    const privB = genPrivateKey();
    const pubB = genPublicKey(privB);

    const sendAmount = toWei(20);
    const feeAmount = toWei(0.5);

    // Create new balance tree with 4 people
    // where userA has 50 credits
    //       userB has 0 credits
    //       userC randomly
    //       userD randomly
    const balanceTreeAccounts = [0, 0, 0, 0].map(
      //@ts-ignore
      (x: any, i: number): SnarkBigInt[] => {
        if (i === userAIndex) {
          return [...pubA, userABalance, bigInt(userANonce)];
        } else if (i === userBIndex) {
          return [...pubB, userBBalance, bigInt(userBNonce)];
        }
        return [...genPublicKey(genPrivateKey()), bigInt(0), bigInt(0)];
      }
    );

    const balanceTree = balanceTreeAccounts.reduce(
      (acc: MerkleTree, pubKeyAndBalance: SnarkBigInt[]): MerkleTree => {
        const leaf = multiHash(pubKeyAndBalance);
        return acc.insert(leaf);
      },
      createMerkleTree(4, bigInt(0))
    );

    const userAPaths = balanceTree.getUpdatePath(userAIndex);
    const userBPaths = balanceTree.getUpdatePath(userBIndex);

    // Create a transaction data
    const txPreSign: Transaction = {
      from: userAIndex,
      to: userBIndex,
      amount: sendAmount,
      fee: feeAmount,
      nonce: userANonce + 1
    };
    const signature = sign(privA, formatTx(txPreSign));
    const tx: Transaction = Object.assign({}, txPreSign, { signature });

    // Construct an intermediateBalanceTree
    const intermediateUserALeafData = [
      ...pubA,
      userABalance.sub(sendAmount).sub(feeAmount),
      userANonce + 1
    ];
    const intermediateUserALeaf = multiHash(intermediateUserALeafData);

    const intermediateBalanceTree = balanceTree.update(
      userAIndex,
      intermediateUserALeaf
    );

    // Note: intermediateBalanceTreePathElements is the path elements after updating
    //       userA's balance
    const intermediateBalanceTreePaths = intermediateBalanceTree.getUpdatePath(
      userBIndex
    );

    // Final Balance Tree
    const finalUserBLeafData = [
      ...pubB,
      userBBalance.add(sendAmount),
      userBNonce // Since user B is receiving, we're not bumping the nonce
    ];
    const finalUserBLeaf = multiHash(finalUserBLeafData);
    const finalBalanceTree = intermediateBalanceTree.update(
      userBIndex,
      finalUserBLeaf
    );

    // Circuit inputs
    const circuitInputs = stringifyBigInts({
      balanceTreeRoot: balanceTree.root,
      txData: formatTx(tx),
      txSenderPublicKey: pubA,
      txSenderBalance: userABalance,
      txSenderNonce: userANonce,
      txSenderPathElements: userAPaths.pathElements,
      txRecipientPublicKey: pubB,
      txRecipientBalance: userBBalance,
      txRecipientNonce: userBNonce,
      txRecipientPathElements: userBPaths.pathElements,
      intermediateBalanceTreeRoot: intermediateBalanceTree.root,
      intermediateBalanceTreePathElements:
        intermediateBalanceTreePaths.pathElements
    });

    const witness = circuit.calculateWitness(circuitInputs);
    const outputIdx = circuit.getSignalIdx("main.newBalanceTreeRoot");
    const newBalanceTreeRootCircom = witness[outputIdx];

    expect(finalBalanceTree.root.toString()).toEqual(
      newBalanceTreeRootCircom.toString()
    );
  });

  it("ProcessTx(4), same sender and recipient", async () => {
    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "processtx_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    const userAIndex = 0;
    const userABalance = toWei(50);
    const userANonce = 1;
    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);

    const sendAmount = toWei(20);
    const feeAmount = toWei(0.5);

    // Create new balance tree with 4 people
    // where userA has 50 credits
    const balanceTreeAccounts = [0, 0, 0, 0].map(
      //@ts-ignore
      (x: any, i: number): SnarkBigInt[] => {
        if (i === userAIndex) {
          return [...pubA, userABalance, bigInt(userANonce)];
        }
        return [...genPublicKey(genPrivateKey()), bigInt(0), bigInt(0)];
      }
    );

    const balanceTree = balanceTreeAccounts.reduce(
      (acc: MerkleTree, pubKeyAndBalance: SnarkBigInt[]): MerkleTree => {
        const leaf = multiHash(pubKeyAndBalance);
        return acc.insert(leaf);
      },
      createMerkleTree(4, bigInt(0))
    );

    const userAPaths = balanceTree.getUpdatePath(userAIndex);

    // Create a transaction data
    const txPreSign: Transaction = {
      from: userAIndex,
      to: userAIndex,
      amount: sendAmount,
      fee: feeAmount,
      nonce: userANonce + 1
    };
    const signature = sign(privA, formatTx(txPreSign));
    const tx: Transaction = Object.assign({}, txPreSign, { signature });

    // Construct an intermediateBalanceTree
    const intermediateUserALeafData = [
      ...pubA,
      userABalance.sub(sendAmount).sub(feeAmount),
      userANonce + 1
    ];
    const intermediateUserALeaf = multiHash(intermediateUserALeafData);

    const intermediateBalanceTree = balanceTree.update(
      userAIndex,
      intermediateUserALeaf
    );

    // Note: intermediateBalanceTreePathElements is the path elements after updating
    //       userA's balance
    const intermediateBalanceTreePaths = intermediateBalanceTree.getUpdatePath(
      userAIndex
    );

    // Final Balance Tree
    const finalUserALeafData = [
      ...pubA,
      userABalance
        .sub(sendAmount)
        .add(sendAmount)
        .sub(feeAmount),
      userANonce + 1
    ];
    const finalUserALeaf = multiHash(finalUserALeafData);
    const finalBalanceTree = intermediateBalanceTree.update(
      userAIndex,
      finalUserALeaf
    );

    // Circuit inputs
    const circuitInputs = stringifyBigInts({
      balanceTreeRoot: balanceTree.root,
      txData: formatTx(tx),
      txSenderPublicKey: pubA,
      txSenderBalance: userABalance,
      txSenderNonce: userANonce,
      txSenderPathElements: userAPaths.pathElements,
      txRecipientPublicKey: pubA,
      txRecipientBalance: userABalance,
      txRecipientNonce: userANonce,
      txRecipientPathElements: userAPaths.pathElements,
      intermediateBalanceTreeRoot: intermediateBalanceTree.root,
      intermediateBalanceTreePathElements:
        intermediateBalanceTreePaths.pathElements
    });

    const witness = circuit.calculateWitness(circuitInputs);
    const outputIdx = circuit.getSignalIdx("main.newBalanceTreeRoot");
    const newBalanceTreeRootCircom = witness[outputIdx];

    expect(finalBalanceTree.root.toString()).toEqual(
      newBalanceTreeRootCircom.toString()
    );
  });
});
