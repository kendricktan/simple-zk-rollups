import { bigInt } from "snarkjs";

import { deployCircomLib, deployHasher, deployMerkleTree } from "./common";
import { createMerkleTree } from "../../operator/src/utils/merkletree";
import { multiHash, genPrivateKey } from "../../operator/src/utils/crypto";

describe("MerkleTree.sol", () => {
  let circomLibContract;
  let hasherContract;
  let merkleTreeContract;

  const depth = 4;
  const zeroValue = bigInt(0);

  beforeAll(async () => {
    circomLibContract = await deployCircomLib();
    hasherContract = await deployHasher(circomLibContract.address);
  });

  beforeEach(async () => {
    merkleTreeContract = await deployMerkleTree(
      depth,
      zeroValue,
      hasherContract.address
    );
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
