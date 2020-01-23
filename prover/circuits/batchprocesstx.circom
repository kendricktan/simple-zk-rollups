include "./processtx.circom";

template BatchProcessTx(batchSize, depth) {
  // params:
  //          batchSize: Batch size of tx's to process (usually 2**depth)
  //          depth: depth of the merkle tree

  // Processes a single transaction
  signal output newBalanceTreeRoot;

  // Merkle Root of the current balance tree
  signal input balanceTreeRoot[batchSize];

  var TX_DATA_WITH_SIG_LENGTH = 8;
  signal input txData[batchSize][TX_DATA_WITH_SIG_LENGTH];

  // Transaction sender data
  signal input txSenderPublicKey[batchSize][2];
  signal input txSenderBalance[batchSize];
  signal input txSenderNonce[batchSize];
  signal input txSenderPathElements[batchSize][depth];

  // Transaction recipient data
  signal input txRecipientPublicKey[batchSize][2];
  signal input txRecipientBalance[batchSize];
  signal input txRecipientNonce[batchSize];
  signal input txRecipientPathElements[batchSize][depth];

  // Intermediate balance tree root
  // i.e. intermediateBalanceTreeRoot corresponds to the tree root
  //      after txSender has been updated on the tree, but not
  //      txRecipient
  signal input intermediateBalanceTreeRoot[batchSize];
  signal input intermediateBalanceTreePathElements[batchSize][depth];

  component processTx[batchSize];
  for (var i = 0; i < batchSize; i++) {
    processTx[i] = ProcessTx(depth);

    processTx[i].balanceTreeRoot <== balanceTreeRoot[i];

    for (var j = 0; j < TX_DATA_WITH_SIG_LENGTH; j++) {
      processTx[i].txData[j] <== txData[i][j];
    }

    // Tx sender
    processTx[i].txSenderPublicKey[0] <== txSenderPublicKey[i][0];
    processTx[i].txSenderPublicKey[1] <== txSenderPublicKey[i][1];
    processTx[i].txSenderBalance <== txSenderBalance[i];
    processTx[i].txSenderNonce <== txSenderNonce[i];

    // Tx recipient
    processTx[i].txRecipientPublicKey[0] <== txRecipientPublicKey[i][0];
    processTx[i].txRecipientPublicKey[1] <== txRecipientPublicKey[i][1];
    processTx[i].txRecipientBalance <== txRecipientBalance[i];
    processTx[i].txRecipientNonce <== txRecipientNonce[i];

    // Path Elements for tx sender and recipient
    // and intermediatePathElements
    for (var j = 0; j < depth; j++) {
      processTx[i].txSenderPathElements[j] <== txSenderPathElements[i][j];
      processTx[i].txRecipientPathElements[j] <== txRecipientPathElements[i][j];
      processTx[i].intermediateBalanceTreePathElements[j] <== intermediateBalanceTreePathElements[i][j];
    }

    processTx[i].intermediateBalanceTreeRoot <== intermediateBalanceTreeRoot[i];
  }

  // Make sure calculated roots are valid
  for (var i = 1; i < batchSize; i++) {
    balanceTreeRoot[i] === processTx[i - 1].newBalanceTreeRoot;
  }

  newBalanceTreeRoot <== processTx[batchSize - 1].newBalanceTreeRoot;
}