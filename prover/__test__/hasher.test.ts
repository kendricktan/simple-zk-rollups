import * as path from "path";
import * as compiler from "circom";

import { Circuit, bigInt } from "snarkjs";
import { multiHash } from "../../operator/src/utils/crypto";

describe("hasher.circom", () => {
  it("Hasher(1)", async () => {
    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "hasher_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    const circuitInputs = {
      in: ["32767"],
      key: "0"
    };

    const witness = circuit.calculateWitness(circuitInputs);

    const outputIdx = circuit.getSignalIdx("main.hash");
    const output = witness[outputIdx];

    const outputJS = multiHash([bigInt(32767)]);

    expect(output.toString()).toEqual(outputJS.toString());
  });

  it("HashLeftRight()", async () => {
    const circuitDef = await compiler(
      path.join(__dirname, "circuits", "hasher_hashleftright_test.circom")
    );
    const circuit = new Circuit(circuitDef);

    const circuitInputs = {
      left: "12345",
      right: "45678"
    };

    const witness = circuit.calculateWitness(circuitInputs);

    const outputIdx = circuit.getSignalIdx("main.hash");
    const output = witness[outputIdx];

    const outputJS = multiHash([bigInt(12345), bigInt(45678)]);

    expect(output.toString()).toEqual(outputJS.toString());
  });
});
