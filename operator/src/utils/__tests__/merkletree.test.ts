import { bigInt } from "snarkjs";
import { stringify } from "../helpers";
import { MerkleTree, createMerkleTree } from "../merkletree";
import { hash, multiHash, genPrivateKey } from "../crypto";
import { SnarkBigInt } from "../../types/primitives";

describe("merkletree.ts", () => {
  it("Creating a merkletree", () => {
    createMerkleTree(4, bigInt(10));
  });

  it("Merkle Tree Comparator", () => {
    const m1 = createMerkleTree(4, bigInt(0));
    const m2 = createMerkleTree(4, bigInt(0));
    const m3 = createMerkleTree(4, bigInt(1));

    expect(m1.equals(m2)).toEqual(true);
    expect(m2.equals(m3)).toEqual(false);
  });

  it("Inserting Element(s)", () => {
    const m = createMerkleTree(4, bigInt(0));

    const leafRaw = [0, 0, 0, 0].map(() => genPrivateKey());
    const leaf = multiHash(leafRaw);

    const m1 = m.insert(leaf, leafRaw);
    const m2 = m.insert(leaf, leafRaw);

    expect(m.equals(m1)).toEqual(false);
    expect(m1.equals(m2)).toEqual(true);

    expect(m.nextLeafIndex).toEqual(0);
    expect(m1.nextLeafIndex).toEqual(1);

    expect(stringify(m1.leaves[0])).toEqual(stringify(leaf));
    expect(stringify(m1.leavesRaw[0])).toEqual(stringify(leafRaw));
  });

  it("Updating Elements", () => {
    // Initialize merkletree with 4 elements
    const existingLeafRaw = [0, 0, 0, 0].map(() => genPrivateKey());
    const m = existingLeafRaw.reduce(
      (acc: MerkleTree, leafRaw: SnarkBigInt): MerkleTree => {
        const leaf = hash(leafRaw);
        return acc.insert(leaf, leafRaw);
      },
      createMerkleTree(4, bigInt(0))
    );

    for (let i = 0; i < existingLeafRaw.length; i++) {
      const leafRaw = existingLeafRaw[i];
      const leaf = hash(leafRaw);

      expect(stringify(m.leaves[i])).toEqual(stringify(leaf));
      expect(stringify(m.leavesRaw[i])).toEqual(stringify(leafRaw));
    }

    // Update element 2 of tree
    const leafIndex = 2;
    const leafRaw = [0, 0, 0, 0].map(() => genPrivateKey());
    const leaf = multiHash(leafRaw);
    const m2 = m.update(leafIndex, leaf, leafRaw);

    expect(stringify(m2.leavesRaw[2])).toEqual(stringify(leafRaw));
    expect(stringify(m2.leaves[2])).toEqual(stringify(leaf));
  });
});
