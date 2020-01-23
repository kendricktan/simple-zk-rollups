include "./merkletree.circom";
include "./eddsa.circom";
include "./hasher.circom";

include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mimcsponge.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template ProcessTx(depth) {
  // Processes a single transaction
  signal output newBalanceTreeRoot;

  // Merkle Root of the current balance tree
  signal input balanceTreeRoot;

  // Leaf data length in the balance tree is 3
  // [public_key_x, public_key_y, balance, nonce]
  var BALANCE_TREE_LEAF_DATA_LENGTH = 4;

  /*
    Anatomy of a transaction
    [0] - from
    [1] - to
    [2] - amount to send (in wei)
    [3] - fee (in wei)
    [4] - nonce
    [5] - signature R8X
    [6] - signature R8Y
    [7] - signature S
    Note: Signature is obtained from public key of 'from' in the merkle tree
  */
  var TX_DATA_FROM_IDX = 0;
  var TX_DATA_TO_IDX = 1;
  var TX_DATA_AMOUNT_WEI_IDX = 2;
  var TX_DATA_FEE_WEI_IDX = 3;
  var TX_DATA_NONCE_IDX = 4;
  var TX_DATA_SIGNATURE_R8X_IDX = 5;
  var TX_DATA_SIGNATURE_R8Y_IDX = 6;
  var TX_DATA_SIGNATURE_S_IDX = 7;

  var TX_DATA_WITHOUT_SIG_LENGTH = 5;
  var TX_DATA_WITH_SIG_LENGTH = 8;

  signal input txData[TX_DATA_WITH_SIG_LENGTH];

  // Transaction sender data
  signal input txSenderPublicKey[2];
  signal input txSenderBalance;
  signal input txSenderNonce;
  signal input txSenderPathElements[depth];
  component txSenderPathIndexes = Num2Bits(depth);
  txSenderPathIndexes.in <== txData[TX_DATA_FROM_IDX];

  // Transaction recipient data
  signal input txRecipientPublicKey[2];
  signal input txRecipientBalance;
  signal input txRecipientNonce;
  signal input txRecipientPathElements[depth];
  component txRecipientPathIndexes = Num2Bits(depth);
  txRecipientPathIndexes.in <== txData[TX_DATA_TO_IDX];

  // Intermediate balance tree root
  // i.e. intermediateBalanceTreeRoot corresponds to the tree root
  //      after txSender has been updated on the tree, but not
  //      txRecipient
  signal input intermediateBalanceTreeRoot;
  signal input intermediateBalanceTreePathElements[depth];
  component intermediateBalanceTreePathIndexes = Num2Bits(depth);
  intermediateBalanceTreePathIndexes.in <== txData[TX_DATA_TO_IDX];

  // Step 1.1 Make sure that the signature is valid
  component validTxSignature = VerifyEdDSASignature(TX_DATA_WITHOUT_SIG_LENGTH);
  validTxSignature.fromX <== txSenderPublicKey[0];
  validTxSignature.fromY <== txSenderPublicKey[1];
  validTxSignature.R8x <== txData[TX_DATA_SIGNATURE_R8X_IDX];
  validTxSignature.R8y <== txData[TX_DATA_SIGNATURE_R8Y_IDX];
  validTxSignature.S <== txData[TX_DATA_SIGNATURE_S_IDX];
  for (var i = 0; i < TX_DATA_WITHOUT_SIG_LENGTH; i++) {
    validTxSignature.preimage[i] <== txData[i];
  }
  validTxSignature.valid === 1;

  // Step 1.2 Make sure that the nonce, send value and fee are valid
  txData[TX_DATA_NONCE_IDX] === txSenderNonce + 1;

  component validAmount = GreaterThan(256);
  validAmount.in[0] <== txData[TX_DATA_AMOUNT_WEI_IDX];
  validAmount.in[1] <== 0;
  validAmount.out === 1;

  component validFee = GreaterThan(256);
  validFee.in[0] <== txData[TX_DATA_FEE_WEI_IDX];
  validFee.in[1] <== 0;
  validFee.out === 1;

  // Step 2. Make sure that the balance > amount to send + fee
  component senderSufficientBalance = GreaterThan(256);
  senderSufficientBalance.in[0] <== txSenderBalance;
  senderSufficientBalance.in[1] <== txData[TX_DATA_AMOUNT_WEI_IDX] + txData[TX_DATA_FEE_WEI_IDX];
  senderSufficientBalance.out === 1;

  // Step 3. Make sure that 'from' index actually corresponds to
  //         the public key and the balance
  // Get the hash of the sender's leaf
  component txSenderLeaf = Hasher(BALANCE_TREE_LEAF_DATA_LENGTH);
  txSenderLeaf.key <== 0;
  txSenderLeaf.in[0] <== txSenderPublicKey[0];
  txSenderLeaf.in[1] <== txSenderPublicKey[1];
  txSenderLeaf.in[2] <== txSenderBalance;
  txSenderLeaf.in[3] <== txSenderNonce;

  component txRecipientLeaf = Hasher(BALANCE_TREE_LEAF_DATA_LENGTH);
  txRecipientLeaf.key <== 0;
  txRecipientLeaf.in[0] <== txRecipientPublicKey[0];
  txRecipientLeaf.in[1] <== txRecipientPublicKey[1];
  txRecipientLeaf.in[2] <== txRecipientBalance;
  txRecipientLeaf.in[3] <== txRecipientNonce;

  // Make sure that the leaf does exist in the balance tree
  component correctTxSender = MerkleTreeLeafExists(depth);
  correctTxSender.leaf <== txSenderLeaf.hash;
  correctTxSender.root <== balanceTreeRoot;
  for (var i = 0; i < depth; i++) {
    correctTxSender.pathElements[i] <== txSenderPathElements[i];
    correctTxSender.pathIndexes[i] <== txSenderPathIndexes.out[i];
  }

  component correctTxRecipient = MerkleTreeLeafExists(depth);
  correctTxRecipient.leaf <== txRecipientLeaf.hash;
  correctTxRecipient.root <== balanceTreeRoot;
  for (var i = 0; i < depth; i++) {
    correctTxRecipient.pathElements[i] <== txRecipientPathElements[i];
    correctTxRecipient.pathIndexes[i] <== txRecipientPathIndexes.out[i];
  }

  // Step 4. If the above is valid, create new txSender and txRecipient leaf
  signal newTxSenderBalance;
  newTxSenderBalance <== txSenderBalance - txData[TX_DATA_AMOUNT_WEI_IDX] - txData[TX_DATA_FEE_WEI_IDX];

  component newTxSenderLeaf = Hasher(BALANCE_TREE_LEAF_DATA_LENGTH);
  newTxSenderLeaf.key <== 0;
  newTxSenderLeaf.in[0] <== txSenderPublicKey[0];
  newTxSenderLeaf.in[1] <== txSenderPublicKey[1];
  newTxSenderLeaf.in[2] <== newTxSenderBalance;
  newTxSenderLeaf.in[3] <== txData[TX_DATA_NONCE_IDX];

  // If sender === recipient, then we need to use the modified
  // sender data, instead of using the existing recipient data
  // otherwise they could just keep sending money to themselves and
  // not get deducted
  component senderRecipientSame = IsEqual();
  senderRecipientSame.in[0] <== txData[TX_DATA_FROM_IDX];
  senderRecipientSame.in[1] <== txData[TX_DATA_TO_IDX];

  component selectedTxRecipientBalance = Mux1();
  selectedTxRecipientBalance.c[0] <== txRecipientBalance;
  selectedTxRecipientBalance.c[1] <== newTxSenderBalance;
  selectedTxRecipientBalance.s <== senderRecipientSame.out;

  component selectedTxRecipientNonce = Mux1();
  selectedTxRecipientNonce.c[0] <== txRecipientNonce;
  selectedTxRecipientNonce.c[1] <== txData[TX_DATA_NONCE_IDX];
  selectedTxRecipientNonce.s <== senderRecipientSame.out;

  component newTxRecipientLeaf = Hasher(BALANCE_TREE_LEAF_DATA_LENGTH);
  newTxRecipientLeaf.key <== 0;
  newTxRecipientLeaf.in[0] <== txRecipientPublicKey[0];
  newTxRecipientLeaf.in[1] <== txRecipientPublicKey[1];
  newTxRecipientLeaf.in[2] <== selectedTxRecipientBalance.out + txData[TX_DATA_AMOUNT_WEI_IDX];
  newTxRecipientLeaf.in[3] <== selectedTxRecipientNonce.out;

  // Step 5.1 Update txSender
  component computedIntermediateBalanceTree = MerkleTreeRootConstructor(depth);
  computedIntermediateBalanceTree.leaf <== newTxSenderLeaf.hash;
  for (var i = 0; i < depth; i++) {
    computedIntermediateBalanceTree.pathElements[i] <== txSenderPathElements[i];
    computedIntermediateBalanceTree.pathIndexes[i] <== txSenderPathIndexes.out[i];
  }
  
  // Step 5.2 Make sure computed root is the same as supplied root
  computedIntermediateBalanceTree.root === intermediateBalanceTreeRoot;

  // Step 5.3 Update txRecipient
  component computedFinalBalanceTree = MerkleTreeRootConstructor(depth);
  computedFinalBalanceTree.leaf <== newTxRecipientLeaf.hash;
  for (var i = 0; i < depth; i++) {
    computedFinalBalanceTree.pathElements[i] <== intermediateBalanceTreePathElements[i];
    computedFinalBalanceTree.pathIndexes[i] <== intermediateBalanceTreePathIndexes.out[i];
  }

  newBalanceTreeRoot <== computedFinalBalanceTree.root;
}