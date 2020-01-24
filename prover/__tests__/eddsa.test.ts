import * as path from "path";
import * as compiler from "circom";

import { Circuit } from "snarkjs";
import {
  sign,
  genPrivateKey,
  genPublicKey
} from "../../operator/src/utils/crypto";
import { stringifyBigInts } from "../../operator/src/utils/helpers";

describe("eddsa.circom", () => {
  it("VerifyEdDSASignature(4)", async () => {
    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "eddsa_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);

    const msg = [0, 0, 0, 0].map(() => genPrivateKey());
    const signature = sign(privA, msg);

    const circuitInputs = stringifyBigInts({
      fromX: pubA[0],
      fromY: pubA[1],
      R8x: signature.R8[0],
      R8y: signature.R8[1],
      S: signature.S,
      preimage: msg
    });
    const witness = circuit.calculateWitness(circuitInputs);
    const outputIdx = circuit.getSignalIdx("main.valid");
    const output = witness[outputIdx];

    expect(output.toString()).toEqual("1");
  });
});
