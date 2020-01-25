module.exports = {
  // Note you'll also need to change parameters of `./prover/circuits/main.circom`
  // for the effect to take place
  balanceTree: {
    depth: 2 || parseInt(process.env.BALANCE_TREE_DEPTH),
    zeroValue:
      process.env.BALANCE_TREE_ZERO_VALUE === undefined
        ? 0n
        : BigInt(process.env.BALANCE_TREE_ZERO_VALUE)
  },
  processTxCircuit: {
    batchSize: 4 || parseInt(process.env.PROCESS_TX_CIRCUIT_BATCH_SIZE)
  }
};
