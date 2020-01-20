import * as path from "path";
import * as compiler from "circom";

import { Circuit } from "snarkjs";
import {
  ecdh,
  genPrivateKey,
  genPublicKey,
  formatPrivKeyForBabyJub
} from "../../operator/src/utils/crypto";
import { stringifyBigInts } from "../../operator/src/utils/helpers";

describe("ecdh.circom", () => {
  it("Ecdh()", async () => {
    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "ecdh_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);

    const privB = genPrivateKey();
    const pubB = genPublicKey(privB);

    const circuitInputs = stringifyBigInts({
      privateKey: formatPrivKeyForBabyJub(privA),
      publicKey: pubB
    });

    const witness = circuit.calculateWitness(circuitInputs);
    const outputIdx = circuit.getSignalIdx("main.sharedKey");
    const output = witness[outputIdx];

    const outputJS = ecdh(privB, pubA);

    expect(output.toString()).toEqual(outputJS.toString());
  });
});
