import * as path from "path";
import * as compiler from "circom";

import { Circuit, bigInt } from "snarkjs";
import { genPrivateKey, hash } from "../../operator/src/utils/crypto";
import { stringifyBigInts } from "../../operator/src/utils/helpers";
import {
  createMerkleTree,
  MerkleTree
} from "../../operator/src/utils/merkletree";
import { SnarkBigInt } from "../../operator/src/types/primitives";

describe("merkletree.circom", () => {
  it("PathSelector()", async () => {
    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "merkletree_pathselector_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    const leaf = genPrivateKey();
    const pathElement = genPrivateKey();

    // When pathSelectorpathIndex = 0,
    // the PathSelector.left should be the leaf
    //     PathSelector.right should be the pathElement
    // Check out merkletree.ts's getUpdatePath for more info

    // When pathSelector.pathIndex = 1,
    // the PathSelector.left should be the pathElement
    //     PathSelector.right should be the leaf
    const pathIndexes = [0, 1];

    pathIndexes.forEach(pathIndex => {
      const circuitInputs = stringifyBigInts({
        in: leaf,
        pathElement,
        pathIndex
      });

      const witness = circuit.calculateWitness(circuitInputs);

      const leftIdx = circuit.getSignalIdx("main.left");
      const left = witness[leftIdx];

      const rightIdx = circuit.getSignalIdx("main.right");
      const right = witness[rightIdx];

      if (pathIndex === 0) {
        expect(left.toString()).toEqual(leaf.toString());
        expect(right.toString()).toEqual(pathElement.toString());
      } else if (pathIndex === 1) {
        expect(left.toString()).toEqual(pathElement.toString());
        expect(right.toString()).toEqual(leaf.toString());
      }
    });
  });

  it("MerkleTreeRootConstructor(4)", async () => {
    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "merkletree_rootconstructor_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    // Create merkle tree with existing leaves
    const existingLeafRaw = [0, 0, 0, 0].map(() => genPrivateKey());
    const m = existingLeafRaw.reduce(
      (acc: MerkleTree, leafRaw: SnarkBigInt): MerkleTree => {
        const leaf = hash(leafRaw);
        return acc.insert(leaf, leafRaw);
      },
      createMerkleTree(4, bigInt(0))
    );

    const leafIndex = 2;
    const leaf = m.leaves[leafIndex];
    const { pathElements, pathIndexes } = m.getUpdatePath(leafIndex);

    const circuitInputs = stringifyBigInts({
      leaf,
      pathElements,
      pathIndexes
    });

    const witness = circuit.calculateWitness(circuitInputs);
    const rootIdx = circuit.getSignalIdx("main.root");
    const root = witness[rootIdx];

    expect(root.toString()).toEqual(m.root.toString());
  });

  it("MerkleTreeLeafExists(4)", async () => {
    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "merkletree_leafexists_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    // Create merkle tree with existing leaves
    const existingLeafRaw = [0, 0, 0, 0].map(() => genPrivateKey());
    const m = existingLeafRaw.reduce(
      (acc: MerkleTree, leafRaw: SnarkBigInt): MerkleTree => {
        const leaf = hash(leafRaw);
        return acc.insert(leaf, leafRaw);
      },
      createMerkleTree(4, bigInt(0))
    );

    const leafIndex = 2;
    const leaf = m.leaves[leafIndex];
    const { pathElements, pathIndexes } = m.getUpdatePath(leafIndex);
    const root = m.root;

    const validCircuitInputs = stringifyBigInts({
      leaf,
      pathElements,
      pathIndexes,
      root
    });
    circuit.calculateWitness(validCircuitInputs);

    const invalidLeaf = m.leaves[0];
    const invalidCircuitInputs = stringifyBigInts({
      leaf: invalidLeaf,
      pathElements,
      pathIndexes,
      root
    });

    const f = () => circuit.calculateWitness(invalidCircuitInputs);
    expect(f).toThrow(Error);
  });
});
