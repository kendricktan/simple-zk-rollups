import * as path from "path";
import * as compiler from "circom";

import { Circuit, bigInt } from "snarkjs";
import { PrivateKey, Publickey } from "../../operator/src/types/primitives";
import {
  Transaction,
  BalanceTreeLeafData
} from "../../operator/src/types/models";
import {
  toWei,
  formatTx,
  hashBalanceTreeLeaf,
  randomItem,
  stringifyBigInts,
  copyObject
} from "../../operator/src/utils/helpers";
import {
  genPrivateKey,
  genPublicKey,
  sign
} from "../../operator/src/utils/crypto";
import {
  createMerkleTree,
  MerkleTree
} from "../../operator/src/utils/merkletree";

interface User {
  index: number;
  privateKey: PrivateKey;
  publicKey: Publickey;
}

interface ProcessTxAccumulator {
  tx: Transaction;
  balanceTree: MerkleTree;
  intermediateBalanceTree: MerkleTree;
  finalBalanceTree: MerkleTree;
}

const generateUser = (index: number): User => {
  const privateKey = genPrivateKey();
  const publicKey = genPublicKey(privateKey);

  return {
    index,
    privateKey,
    publicKey
  };
};

const generateTransaction = (
  balanceTree: MerkleTree,
  users: User[]
): Transaction => {
  const sender: User = randomItem(users);
  const recipient: User = randomItem(users);

  const amount = toWei(1);
  const fee = toWei(0.5);

  const senderBalanceTreeData: BalanceTreeLeafData = copyObject(
    balanceTree.leavesRaw[sender.index]
  );
  const senderNonce = senderBalanceTreeData.nonce;

  const txPreSign: Transaction = {
    from: sender.index,
    to: recipient.index,
    amount,
    fee,
    nonce: senderNonce + 1
  };

  const signature = sign(sender.privateKey, formatTx(txPreSign));
  const tx: Transaction = Object.assign({}, txPreSign, { signature });

  return tx;
};

const processTransaction = (
  acc: ProcessTxAccumulator
): ProcessTxAccumulator => {
  const { tx, finalBalanceTree } = acc;

  // New tree starts from previous last tree
  const prevFinalBalanceTree = copyObject(finalBalanceTree);

  // Update sender
  const sender: BalanceTreeLeafData = copyObject(
    prevFinalBalanceTree.leavesRaw[tx.from]
  );
  const intermediateBalanceTreeLeafData: BalanceTreeLeafData = {
    publicKey: sender.publicKey,
    balance: sender.balance.sub(tx.amount).sub(tx.fee),
    nonce: sender.nonce + 1
  };
  const newIntermediateBalanceTree: MerkleTree = prevFinalBalanceTree.update(
    tx.from,
    hashBalanceTreeLeaf(intermediateBalanceTreeLeafData),
    intermediateBalanceTreeLeafData
  );

  // Update recipient
  const recipient: BalanceTreeLeafData = copyObject(
    newIntermediateBalanceTree.leavesRaw[tx.to]
  );
  const finalBalanceTreeLeafData: BalanceTreeLeafData = {
    publicKey: recipient.publicKey,
    balance: recipient.balance.add(tx.amount),
    nonce: recipient.nonce
  };
  const newFinalBalanceTree: MerkleTree = newIntermediateBalanceTree.update(
    tx.to,
    hashBalanceTreeLeaf(finalBalanceTreeLeafData),
    finalBalanceTreeLeafData
  );

  return {
    tx,
    balanceTree: prevFinalBalanceTree,
    intermediateBalanceTree: newIntermediateBalanceTree,
    finalBalanceTree: newFinalBalanceTree
  };
};

describe("batchprocesstx.circom", () => {
  it("BatchProcessTx(4, 5)", async () => {
    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "batchprocesstx_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    const numberOfUsers = 10;
    const batchSize = 4;
    const depth = 5;

    const arrayUsersNo = Array(numberOfUsers).fill(0);
    const arrayBatchSize = Array(batchSize).fill(0);

    // Create users
    const users: User[] = arrayUsersNo.map((_, i: number) => generateUser(i));

    // Create balance leaves
    const balanceTreeLeafData: BalanceTreeLeafData[] = users.map(
      ({ publicKey }): BalanceTreeLeafData => {
        return { publicKey, balance: toWei(1000), nonce: 0 };
      }
    );

    // Create balanceTree
    const initialBalanceTree: MerkleTree = balanceTreeLeafData.reduce(
      (acc: MerkleTree, leafData: BalanceTreeLeafData): MerkleTree => {
        return acc.insert(hashBalanceTreeLeaf(leafData), leafData);
      },
      createMerkleTree(depth, bigInt(0))
    );

    // Process transactions
    const processedTxs: ProcessTxAccumulator[] = arrayBatchSize.reduce(
      (acc: ProcessTxAccumulator[], _) => {
        if (acc.length === 0) {
          const tx = generateTransaction(initialBalanceTree, users);
          const processedTx = processTransaction({
            tx,
            balanceTree: initialBalanceTree,
            intermediateBalanceTree: initialBalanceTree,
            finalBalanceTree: initialBalanceTree
          });
          acc.push(processedTx);
        } else {
          const lastAcc: ProcessTxAccumulator = acc.slice(-1)[0];
          const tx = generateTransaction(lastAcc.finalBalanceTree, users);
          const processedTx = processTransaction({
            tx,
            balanceTree: lastAcc.balanceTree,
            intermediateBalanceTree: lastAcc.intermediateBalanceTree,
            finalBalanceTree: lastAcc.finalBalanceTree
          });
          acc.push(processedTx);
        }

        return acc;
      },
      []
    );

    // Construct circuit inputs
    const circuitInputs = processedTxs.reduce(
      (acc, curProcessedTx: ProcessTxAccumulator) => {
        const { tx, balanceTree, intermediateBalanceTree } = curProcessedTx;

        const sender: BalanceTreeLeafData = copyObject(
          balanceTree.leavesRaw[tx.from]
        );
        const recipient: BalanceTreeLeafData = copyObject(
          balanceTree.leavesRaw[tx.to]
        );

        const senderPaths = balanceTree.getUpdatePath(tx.from);
        const recipientPaths = balanceTree.getUpdatePath(tx.to);

        const intermediateBalanceTreePaths = intermediateBalanceTree.getUpdatePath(
          tx.to
        );

        const currentInputs = {
          balanceTreeRoot: balanceTree.root,
          txData: formatTx(tx),
          txSenderPublicKey: sender.publicKey,
          txSenderBalance: sender.balance,
          txSenderNonce: sender.nonce,
          txSenderPathElements: senderPaths.pathElements,
          txRecipientPublicKey: recipient.publicKey,
          txRecipientBalance: recipient.balance,
          txRecipientNonce: recipient.nonce,
          txRecipientPathElements: recipientPaths.pathElements,
          intermediateBalanceTreeRoot: intermediateBalanceTree.root,
          intermediateBalanceTreePathElements:
            intermediateBalanceTreePaths.pathElements
        };

        Object.keys(acc).forEach(k => {
          acc[k].push(currentInputs[k]);
        });

        return acc;
      },
      {
        balanceTreeRoot: [],
        txData: [],
        txSenderPublicKey: [],
        txSenderBalance: [],
        txSenderNonce: [],
        txSenderPathElements: [],
        txRecipientPublicKey: [],
        txRecipientBalance: [],
        txRecipientNonce: [],
        txRecipientPathElements: [],
        intermediateBalanceTreeRoot: [],
        intermediateBalanceTreePathElements: []
      }
    );

    const { finalBalanceTree } = processedTxs.slice(-1)[0];

    const witness = circuit.calculateWitness(stringifyBigInts(circuitInputs));
    const outputIdx = circuit.getSignalIdx("main.newBalanceTreeRoot");
    const newBalanceTreeRootCircom = witness[outputIdx];

    expect(finalBalanceTree.root.toString()).toEqual(
      newBalanceTreeRootCircom.toString()
    );
  });
});
