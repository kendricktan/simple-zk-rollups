import { bigInt } from "snarkjs";

import { multiHash } from "./crypto";
import { SnarkBigInt } from "../types/primitives";
import { copyObject, stringifyBigInts } from "./helpers";

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
  leavesRaw: SnarkBigInt[];

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

    this.maxLeafIndex = Math.pow(2, depth);

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
    const copyA = copyObject(this);

    if (leafIndex >= copyA.nextLeafIndex) {
      throw new Error("Can't update leafIndex which hasn't been inserted yet!");
    }

    const paths = copyA.getUpdatePath(leafIndex);

    copyA.update_(leafIndex, leaf, rawValue, paths[0]);

    return copyA;
  }

  // Stateful update
  update_(
    leafIndex: number,
    leaf: SnarkBigInt,
    rawValue: any,
    path: SnarkBigInt[]
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
        right = path[i];
      } else {
        left = path[i];
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
        right = path[i];

        this.filledPaths[i][curIdx] = left;
        this.filledPaths[i][curIdx + 1] = right;
      } else {
        left = path[i];
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
  getUpdatePath(leafIndex: number): [SnarkBigInt[], number[]] {
    if (leafIndex >= this.nextLeafIndex) {
      throw new Error("Path not constructed yet, leafIndex >= nextIndex");
    }

    let curIdx = leafIndex;
    const path = [];
    const pathIndex = [];

    for (let i = 0; i < this.depth; i++) {
      if (curIdx % 2 === 0) {
        path.push(this.filledPaths[i][curIdx + 1]);
        pathIndex.push(0);
      } else {
        path.push(this.filledPaths[i][curIdx - 1]);
        pathIndex.push(1);
      }
      curIdx = parseInt((curIdx / 2).toString());
    }

    return [path, pathIndex];
  }
}

export const createMerkleTree = (
  depth: number,
  zeroValue: SnarkBigInt = bigInt(0),
  hashFunc: (data: SnarkBigInt[]) => SnarkBigInt = multiHash
): MerkleTree => new MerkleTree(depth, zeroValue, hashFunc);
