import { bigInt } from "snarkjs";
import { stringify, randomRange } from "../../../src/utils/helpers";
import { pgPool, initPg } from "../../../src/db/postgres";
import {
  MerkleTree,
  createMerkleTree,
  saveMerkleTreeToDb,
  loadMerkleTreeFromDb
} from "../../../src/utils/merkletree";
import { hash, multiHash, genPrivateKey } from "../../../src/utils/crypto";
import { SnarkBigInt } from "../../../src/types/primitives";

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

  it("Serialization to/from Postgres", async () => {
    await initPg();

    const mtName = `TestMerkleTree${randomRange(0, 32767).toString()}`;
    const mt1 = createMerkleTree(4, bigInt(0));

    const n1 = [genPrivateKey()];
    const n2 = [genPrivateKey()];
    const n3 = [genPrivateKey()];

    // Need to save on every insert
    const h1 = multiHash(n1);
    const h2 = multiHash(n2);
    const h3 = multiHash(n3);

    const raw1 = n1;
    const raw2 = { inner: n2 };
    const raw3 = [n3];

    mt1.insert_(h1, raw1);
    mt1.insert_(h2, raw2);
    mt1.insert_(h3, raw3);

    // Saves index 0 to merkletree (h1)
    await saveMerkleTreeToDb(pgPool, mtName, mt1, 0);

    // Saves index 1 to merkletree (h2)
    await saveMerkleTreeToDb(pgPool, mtName, mt1, 1);

    // Saves latest index to merkletree (h3)
    await saveMerkleTreeToDb(pgPool, mtName, mt1);

    const mt2 = await loadMerkleTreeFromDb(pgPool, mtName);

    expect(mt1.equals(mt2)).toEqual(true);

    // Update second element
    const h2New = multiHash([h1, h2, h3]);
    mt1.update(1, h2New);

    // Saves updated leave to database
    await saveMerkleTreeToDb(pgPool, mtName, mt1, 1);

    // Compare trees
    const mt3 = await loadMerkleTreeFromDb(pgPool, mtName);

    expect(mt1.equals(mt3)).toEqual(true);

    // Make sure the saves raw values are the same too
    expect(stringify(mt3.leavesRaw[0])).toEqual(stringify(raw1));
    expect(stringify(mt3.leavesRaw[1])).toEqual(stringify(raw2));
    expect(stringify(mt3.leavesRaw[2])).toEqual(stringify(raw3));

    // Delete from merkletree
    await pgPool.query({
      text: `DELETE FROM leaves
             WHERE merkletree_id=(SELECT id from merkletrees WHERE name=$1);`,
      values: [mtName]
    });

    await pgPool.query({
      text: "DELETE FROM merkletrees WHERE name=$1",
      values: [mtName]
    });
  });
});
