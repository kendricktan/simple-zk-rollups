import { bigInt } from "snarkjs";

import { hashBalanceTreeLeaf } from "../utils/helpers";
import { pgPool } from "../db/postgres";
import {
  loadMerkleTreeFromDb,
  saveMerkleTreeToDb,
  MerkleTree
} from "../utils/merkletree";
import { SnarkBigInt } from "../types/primitives";
import { BalanceTreeLeafData } from "../types/models";

import * as config from "../../../zk-rollups.config";

const balanceTreeName = config.balanceTree.name;

// Helper function to update merkleTree
// on "deposit" or "withdrawal" event
export const onEventUpdateMerkleTree = (eventName: string) => {
  return async (
    balanceTreeIndex: SnarkBigInt,
    publicKeyX: SnarkBigInt,
    publicKeyY: SnarkBigInt,
    balance: SnarkBigInt,
    nonce: SnarkBigInt
  ) => {
    console.log(`New ${eventName} event detected!`);
    console.log({
      index: balanceTreeIndex.toString(),
      publicKey: [publicKeyX.toString(), publicKeyY.toString()],
      balance: balance.toString(),
      nonce: nonce.toString()
    });

    const m = await loadMerkleTreeFromDb(pgPool, balanceTreeName);

    const leafIndex = parseInt(balanceTreeIndex.toString());
    const leafData: BalanceTreeLeafData = {
      publicKey: [bigInt(publicKeyX.toString()), bigInt(publicKeyY.toString())],
      balance: bigInt(balance.toString()),
      nonce: bigInt(nonce.toString())
    };
    const leaf = hashBalanceTreeLeaf(leafData);

    // We're out of order....
    if (leafIndex > m.nextLeafIndex) {
      throw new Error("Merkletree out of sync!");
    }

    let m2: MerkleTree;

    // If its a new user, insert it
    if (leafIndex === m.nextLeafIndex) {
      m2 = m.insert(leaf, leafData);
    } else if (leafIndex < m.nextLeafIndex) {
      // If its an existing user, update it
      m2 = m.update(
        parseInt(balanceTreeIndex.toString()),
        hashBalanceTreeLeaf(leafData),
        leafData
      );
    }

    // Save merkle tree
    await saveMerkleTreeToDb(pgPool, balanceTreeName, m2, leafIndex);
  };
};
