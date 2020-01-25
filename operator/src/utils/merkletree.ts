import { Pool } from "pg";

import { bigInt } from "snarkjs";

import { multiHash } from "./crypto";
import { SnarkBigInt } from "../types/primitives";
import { copyObject, stringifyBigInts, unstringifyBigInts } from "./helpers";

export interface MerkleTreePath {
  pathElements: SnarkBigInt[];
  pathIndexes: number[];
}

export class MerkleTree {
  // Merkle Tree root
  root: SnarkBigInt;
  // Merkle Tree depth
  depth: number;

  // Merkle Tree's zero value
  zeroValue: SnarkBigInt;

  // Merkle Tree leaf values
  // and ithe leaf's raw value
  // (since the leaf value is hash(rawValue))
  // i.e. leaves[i] == muliHash(leavesRaw[i])
  leaves: SnarkBigInt[];
  leavesRaw: any;

  // Maximum number of leaves in the tree
  maxLeafIndex: number;

  // Merkle tree "state"
  // Used to efficiently insert and update elements
  // to the tree
  zeros: { [key: number]: SnarkBigInt };
  filledSubtrees: { [key: number]: SnarkBigInt };
  filledPaths: { [key: number]: { [key: number]: SnarkBigInt } };

  // Next Leaf Index
  nextLeafIndex: number;

  // Hash function for the tree
  hashFunc: (data: SnarkBigInt[]) => SnarkBigInt;

  constructor(
    depth: number,
    zeroValue: SnarkBigInt,
    hashFunc: (data: SnarkBigInt[]) => SnarkBigInt = multiHash
  ) {
    this.depth = depth;
    this.zeroValue = zeroValue;

    this.leaves = [];
    this.leavesRaw = [];

    this.maxLeafIndex = Math.pow(2, depth - 1);

    this.zeros = {
      0: zeroValue
    };
    this.filledSubtrees = {
      0: zeroValue
    };
    this.filledPaths = {
      0: {}
    };

    this.hashFunc = hashFunc;

    for (let i = 1; i < depth; i++) {
      this.zeros[i] = hashFunc([this.zeros[i - 1], this.zeros[i - 1]]);
      this.filledSubtrees[i] = this.zeros[i];
      this.filledPaths[i] = {};
    }

    this.root = hashFunc([
      this.zeros[this.depth - 1],
      this.zeros[this.depth - 1]
    ]);

    this.nextLeafIndex = 0;
  }

  equals(o: MerkleTree): boolean {
    const stringify = (x: any) => JSON.stringify(stringifyBigInts(x));

    // Compare every element
    let eq = true;
    Object.keys(this).forEach((k: any) => {
      eq = eq && stringify(this[k]) === stringify(o[k]);
    });

    return eq;
  }

  hashLeftRight(l: SnarkBigInt, r: SnarkBigInt): SnarkBigInt {
    return this.hashFunc([l, r]);
  }

  insert(leaf: SnarkBigInt, rawValue: any = {}): MerkleTree {
    const copyA = copyObject(this);

    if (copyA.nextLeafIndex + 1 >= copyA.maxLeafIndex) {
      throw new Error("Tree at max capacity");
    }

    copyA.insert_(leaf, rawValue);

    return copyA;
  }

  update(leafIndex: number, leaf: SnarkBigInt, rawValue: any = {}): MerkleTree {
    const copyA: MerkleTree = copyObject(this);

    if (leafIndex >= copyA.nextLeafIndex) {
      throw new Error("Can't update leafIndex which hasn't been inserted yet!");
    }

    copyA.update_(leafIndex, leaf, rawValue);

    return copyA;
  }

  update_(leafIndex: number, leaf: SnarkBigInt, rawValue: any = {}) {
    const { pathElements } = this.getUpdatePath(leafIndex);
    this.updateWithManualPath_(leafIndex, leaf, rawValue, pathElements);
  }

  // Stateful update
  updateWithManualPath_(
    leafIndex: number,
    leaf: SnarkBigInt,
    rawValue: any,
    pathElements: SnarkBigInt[]
  ) {
    if (leafIndex >= this.nextLeafIndex) {
      throw new Error("Can't update leafIndex which hasn't been inserted yet!");
    }

    let curIdx = leafIndex;
    let currentLevelHash = this.leaves[leafIndex];
    let left;
    let right;

    for (let i = 0; i < this.depth; i++) {
      if (curIdx % 2 === 0) {
        left = currentLevelHash;
        right = pathElements[i];
      } else {
        left = pathElements[i];
        right = currentLevelHash;
      }

      currentLevelHash = this.hashLeftRight(left, right);
      curIdx = parseInt((curIdx / 2).toString());
    }

    if (this.root !== currentLevelHash) {
      throw new Error("MerkleTree: tree root / current level has mismatch");
    }

    curIdx = leafIndex;
    currentLevelHash = leaf;

    for (let i = 0; i < this.depth; i++) {
      if (curIdx % 2 === 0) {
        left = currentLevelHash;
        right = pathElements[i];

        this.filledPaths[i][curIdx] = left;
        this.filledPaths[i][curIdx + 1] = right;
      } else {
        left = pathElements[i];
        right = currentLevelHash;

        this.filledPaths[i][curIdx - 1] = left;
        this.filledPaths[i][curIdx] = right;
      }

      currentLevelHash = this.hashLeftRight(left, right);
      curIdx = parseInt((curIdx / 2).toString());
    }

    this.root = currentLevelHash;
    this.leaves[leafIndex] = leaf;
    this.leavesRaw[leafIndex] = rawValue;
  }

  // Stateful Insert
  insert_(leaf: SnarkBigInt, rawValue: any = {}) {
    if (this.nextLeafIndex + 1 >= this.maxLeafIndex) {
      throw new Error("Merkle Tree at max capacity");
    }

    let curIdx = this.nextLeafIndex;
    this.nextLeafIndex += 1;

    let currentLevelHash = leaf;
    let left;
    let right;

    for (let i = 0; i < this.depth; i++) {
      if (curIdx % 2 === 0) {
        left = currentLevelHash;
        right = this.zeros[i];

        this.filledSubtrees[i] = currentLevelHash;

        this.filledPaths[i][curIdx] = left;
        this.filledPaths[i][curIdx + 1] = right;
      } else {
        left = this.filledSubtrees[i];
        right = currentLevelHash;

        this.filledPaths[i][curIdx - 1] = left;
        this.filledPaths[i][curIdx] = right;
      }

      currentLevelHash = this.hashLeftRight(left, right);
      curIdx = parseInt((curIdx / 2).toString());
    }

    this.root = currentLevelHash;
    this.leaves.push(leaf);
    this.leavesRaw.push(rawValue);
  }

  /*  Gets the path needed to construct a the tree root
   *  Used for quick verification on updates.
   *  Runs in O(log(N)), where N is the number of leaves
   */
  getUpdatePath(leafIndex: number): MerkleTreePath {
    if (leafIndex >= this.nextLeafIndex) {
      throw new Error("Path not constructed yet, leafIndex >= nextIndex");
    }

    let curIdx = leafIndex;
    const pathElements = [];
    const pathIndexes = [];

    for (let i = 0; i < this.depth; i++) {
      if (curIdx % 2 === 0) {
        pathElements.push(this.filledPaths[i][curIdx + 1]);
        pathIndexes.push(0);
      } else {
        pathElements.push(this.filledPaths[i][curIdx - 1]);
        pathIndexes.push(1);
      }
      curIdx = parseInt((curIdx / 2).toString());
    }

    return {
      pathElements,
      pathIndexes
    };
  }

  getLeafRaw(leafIndex: number): any | null {
    try {
      return this.leavesRaw[leafIndex];
    } catch {
      return null;
    }
  }
}

export const createMerkleTree = (
  depth: number,
  zeroValue: SnarkBigInt = bigInt(0),
  hashFunc: (data: SnarkBigInt[]) => SnarkBigInt = multiHash
): MerkleTree => new MerkleTree(depth, zeroValue, hashFunc);

export const saveMerkleTreeToDb = async (
  pool: Pool,
  mtName: string,
  mt: MerkleTree,
  leafIndex?: number
) => {
  const mtQuery = {
    text: `INSERT INTO
      merkletrees(
        name,
        depth,
        next_index,
        root,
        zero_value,
        zeros,
        filled_sub_trees,
        filled_paths
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) ON CONFLICT (name) DO UPDATE SET
        name = excluded.name,
        depth = excluded.depth,
        next_index = excluded.next_index,
        root = excluded.root,
        zero_value = excluded.zero_value,
        zeros = excluded.zeros,
        filled_sub_trees = excluded.filled_sub_trees,
        filled_paths = excluded.filled_paths
      ;`,
    values: [
      mtName,
      mt.depth,
      mt.nextLeafIndex,
      stringifyBigInts(mt.root),
      stringifyBigInts(mt.zeroValue),
      stringifyBigInts(mt.zeros),
      stringifyBigInts(mt.filledSubtrees),
      stringifyBigInts(mt.filledPaths)
    ]
  };

  // Saves merkle tree state
  await pool.query(mtQuery);

  // Get merkletree id from db
  const mtTreeRes = await pool.query({
    text: "SELECT * FROM merkletrees WHERE name = $1 LIMIT 1;",
    values: [mtName]
  });
  const mtTreeId = mtTreeRes.rows[0].id;

  // Don't save any leaves if tree is empty
  if (leafIndex === undefined && mt.nextLeafIndex === 0) {
    return;
  }

  // Current leaf index
  const selectedLeafIndex =
    leafIndex === undefined ? mt.nextLeafIndex - 1 : leafIndex;

  const leafQuery = {
    text: `INSERT INTO 
          leaves(merkletree_id, index, raw, hash)
          VALUES($1, $2, $3, $4)
          ON CONFLICT(merkletree_id, index) DO UPDATE SET
            merkletree_id = excluded.merkletree_id,
            index = excluded.index,
            raw = excluded.raw,
            hash = excluded.hash
          `,
    values: [
      mtTreeId,
      selectedLeafIndex,
      {
        data: JSON.stringify(stringifyBigInts(mt.leavesRaw[selectedLeafIndex]))
      },
      stringifyBigInts(mt.leaves[selectedLeafIndex])
    ]
  };

  // Saves latest leaf to merkletree id
  await pool.query(leafQuery);
};

export const loadMerkleTreeFromDb = async (
  pool: Pool,
  mtName: String
): Promise<MerkleTree> => {
  const mtQuery = {
    text: "SELECT * FROM merkletrees WHERE name = $1 LIMIT 1;",
    values: [mtName]
  };
  const mtResp = await pool.query(mtQuery);

  if (mtResp.rows.length === 0) {
    throw new Error(`MerkleTree named ${mtName} not found in database`);
  }

  // Get MerkleTree result
  const mtRes = mtResp.rows[0];
  const mtResBigInt = unstringifyBigInts(mtResp.rows[0]);

  const mt = createMerkleTree(mtRes.depth, mtResBigInt.zero_value);

  mt.nextLeafIndex = mtRes.next_index;
  mt.root = mtResBigInt.root;
  mt.zeros = mtResBigInt.zeros;
  mt.filledSubtrees = mtResBigInt.filled_sub_trees;
  mt.filledPaths = mtResBigInt.filled_paths;

  // Get leaves
  const leavesQuery = {
    text: "SELECT * FROM leaves WHERE merkletree_id = $1 ORDER BY index ASC;",
    values: [mtRes.id]
  };
  const leavesResp = await pool.query(leavesQuery);

  // Get leaves values
  const leaves = leavesResp.rows.map(
    (x: any): BigInt => unstringifyBigInts(x.hash)
  );
  const leavesRaw = leavesResp.rows.map((x: any): any =>
    unstringifyBigInts(JSON.parse(x.raw.data))
  );

  mt.leaves = leaves;
  mt.leavesRaw = leavesRaw;

  return mt;
};
