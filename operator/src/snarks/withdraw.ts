import { createProofGenerator } from "./common";

const provingKey = require("../../../prover/build/withdrawProvingKey.json");
const verifyingKey = require("../../../prover/build/withdrawVerifyingKey.json");

export const genWithdrawVerifierProof = createProofGenerator(
  provingKey,
  verifyingKey,
  "withdraw.circom"
);
