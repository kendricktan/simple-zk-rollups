import * as path from "path";
import * as compiler from "circom";

import { Circuit } from "snarkjs";
import {
  genPrivateKey,
  genPublicKey,
  formatPrivKeyForBabyJub
} from "../../operator/src/utils/crypto";
import { stringifyBigInts } from "../../operator/src/utils/helpers";

describe("publickeyderivation.circom", () => {
  it("PublicKeyDerivation()", async () => {
    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);

    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "publickeyderivation_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    const circuitInputs = stringifyBigInts({
      privateKey: formatPrivKeyForBabyJub(privA)
    });

    const witness = circuit.calculateWitness(circuitInputs);
    const publicKeyXIdx = circuit.getSignalIdx("main.publicKey[0]");
    const publicKeyYIdx = circuit.getSignalIdx("main.publicKey[1]");

    const publicKeyX = witness[publicKeyXIdx];
    const publicKeyY = witness[publicKeyYIdx];

    expect(pubA[0].toString()).toEqual(publicKeyX.toString());
    expect(pubA[1].toString()).toEqual(publicKeyY.toString());
  });
});
