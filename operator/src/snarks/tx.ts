import { createProofGenerator } from "./common";

const provingKey = require("../../../prover/build/txProvingKey.json");
const verifyingKey = require("../../../prover/build/txVerifyingKey.json");

export const genTxVerifierProof = createProofGenerator(
  provingKey,
  verifyingKey,
  "tx.circom"
);
