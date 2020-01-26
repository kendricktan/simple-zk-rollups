import * as path from "path";
import * as compiler from "circom";

import { Circuit, groth } from "snarkjs";
import { buildBn128 } from "websnark";
import { binarifyWitness, binarifyProvingKey } from "../utils/binarify";
import { SNARK_FIELD_SIZE } from "../utils/crypto";
import { stringifyBigInts, unstringifyBigInts } from "../utils/helpers";

export const createProofGenerator = (provingKey, verifyingKey, circuitName) => {
  return async circuitInputs => {
    const circuitDef = await compiler(
      path.join(__dirname, `../../../prover/circuits/${circuitName}`)
    );
    const circuit = new Circuit(circuitDef);

    const witness = circuit.calculateWitness(stringifyBigInts(circuitInputs));
    const publicSignals = witness.slice(
      1,
      circuit.nPubInputs + circuit.nOutputs + 1
    );

    const wasmBn128 = await buildBn128();
    const zkSnark = groth;

    // Websnark to generate proof
    const witnessBin = binarifyWitness(witness);
    const provingKeyBin = binarifyProvingKey(provingKey);
    const proof = await wasmBn128.groth16GenProof(witnessBin, provingKeyBin);
    const isValid = zkSnark.isValid(
      unstringifyBigInts(verifyingKey),
      unstringifyBigInts(proof),
      unstringifyBigInts(publicSignals)
    );

    if (!isValid) {
      throw new Error("Invalid proof generated");
    }

    return {
      proof,
      // Verification on solidity is a bit different...
      solidityProof: {
        a: stringifyBigInts(proof.pi_a).slice(0, 2),
        b: stringifyBigInts(proof.pi_b)
          .map(x => x.reverse())
          .slice(0, 2),
        c: stringifyBigInts(proof.pi_c).slice(0, 2),
        inputs: publicSignals.map(x => x.mod(SNARK_FIELD_SIZE).toString())
      }
    };
  };
};
