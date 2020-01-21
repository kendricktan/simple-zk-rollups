include "./hasher.circom";

// if pathIndex == 0 returns (left = in, right = pathElement)
// if pathIndex == 1 returns (left = pathElement, right = in)
template PathSelector() {
  signal input in;
  signal input pathElement;
  signal input pathIndex;

  signal output left;
  signal output right;

  signal leftSelector1;
  signal leftSelector2;
  signal rightSelector1;
  signal rightSelector2;

  // Ensure that pathIndex is either 0 or 1
  pathIndex * (1 - pathIndex) === 0

  leftSelector1 <== (1 - pathIndex) * in;
  leftSelector2 <== (pathIndex) * pathElement;
  rightSelector1 <== (pathIndex) * in;
  rightSelector2 <== (1 - pathIndex) * pathElement;

  left <== leftSelector1 + leftSelector2;
  right <== rightSelector1 + rightSelector2;
}


// Constructs a merkle tree root given a leaf and their
// corresponding path elements
template MerkleTreeRootConstructor(depth) {
  // depth: depth of the merkle tree

  signal input leaf;

  signal private input pathElements[depth];
  signal private input pathIndexes[depth];

  signal output root;

  component selectors[depth];
  component hashers[depth];

  for (var i = 0; i < depth; i++) {
    selectors[i] = PathSelector();
    hashers[i] = HashLeftRight();

    selectors[i].pathElement <== pathElements[i];
    selectors[i].pathIndex <== pathIndexes[i];

    hashers[i].left <== selectors[i].left;
    hashers[i].right <== selectors[i].right;
  }

  selectors[0].in <== leaf;

  for (var i = 1; i < depth; i++) {
    selectors[i].in <== hashers[i-1].hash;
  }

  root <== hashers[depth - 1].hash;
}

// Ensures that a leaf exists within a merkletree with given `root`
template MerkleTreeLeafExists(depth){
  // depth: depth of the merkle tree
  signal input leaf;

  signal private input pathElements[depth];
  signal private input pathIndexes[depth];

  signal input root;

  component merkletree = MerkleTreeRootConstructor(depth);
  merkletree.leaf <== leaf;
  for (var i = 0; i < depth; i++) {
    merkletree.pathElements[i] <== pathElements[i];
    merkletree.pathIndexes[i] <== pathIndexes[i];
  }

  root === merkletree.root;
}
