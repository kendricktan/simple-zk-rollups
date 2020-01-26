module.exports = {
  // Note you'll also need to change parameters of `./prover/circuits/tx.circom`
  // for the effect to take place
  balanceTree: {
    name: "balanceTree",
    depth:
      process.env.BALANCE_TREE_DEPTH === undefined
        ? 6
        : parseInt(process.env.BALANCE_TREE_DEPTH),
    zeroValue:
      process.env.BALANCE_TREE_ZERO_VALUE === undefined
        ? 0n
        : BigInt(process.env.BALANCE_TREE_ZERO_VALUE)
  },
  processTxCircuit: {
    batchSize:
      process.env.PROCESS_TX_CIRCUIT_BATCH_SIZE === undefined
        ? 2
        : parseInt(process.env.PROCESS_TX_CIRCUIT_BATCH_SIZE)
  },
  web3: {
    providerUrl:
      process.env.WEB3_PROVIDER_URL === undefined
        ? "http://localhost:8545"
        : process.env.WEB3_PROVIDER_URL,
    privateKey:
      process.env.DEPLOYER_PRIVATE_KEY === undefined
        ? "0x94a9f52a9ef7933f3865a91766cb5e12d25f62d6aecf1d768508d95526bfee29"
        : process.env.DEPLOYER_PRIVATE_KEY
  },
  redis: {
    lastInsertedKey: "last-inserted",
    lastProcessedKey: "last-processed"
  }
};
