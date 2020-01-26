import { genWithdrawVerifierProof } from "../../operator/src/snarks/withdraw";
import {
  genPrivateKey,
  genPublicKey,
  formatPrivKeyForBabyJub
} from "../../operator/src/utils/crypto";
import { stringifyBigInts } from "../../operator/src/utils/helpers";

import { deployWithdrawVerifier } from "./common";

describe("WithdrawVerifier.sol", () => {
  it("verifyProof()", async done => {
    const privA = genPrivateKey();
    const pubA = genPublicKey(privA);
    const nullifier = genPrivateKey();

    const withdrawVerifierContract = await deployWithdrawVerifier();

    const circuitInputs = stringifyBigInts({
      privateKey: formatPrivKeyForBabyJub(privA),
      nullifier
    });
    // Websnark to generate proof
    const { solidityProof } = await genWithdrawVerifierProof(circuitInputs);

    // Verify that its valid on chain
    const isValidOnChain = await withdrawVerifierContract.verifyProof(
      solidityProof.a,
      solidityProof.b,
      solidityProof.c,
      solidityProof.inputs
    );
    expect(isValidOnChain).toEqual(true);

    expect(pubA[0].toString()).toEqual(solidityProof.inputs[0].toString());
    expect(pubA[1].toString()).toEqual(solidityProof.inputs[1].toString());
    expect(nullifier.toString()).toEqual(solidityProof.inputs[2].toString());

    done();
  });

  it("verifyProof() should fail with modified nullifier", async done => {
    const privA = genPrivateKey();
    const nullifier = genPrivateKey();

    const withdrawVerifierContract = await deployWithdrawVerifier();

    const circuitInputs = stringifyBigInts({
      privateKey: formatPrivKeyForBabyJub(privA),
      nullifier
    });
    // Websnark to generate proof
    const { solidityProof } = await genWithdrawVerifierProof(circuitInputs);

    // Change nullifier
    solidityProof.inputs[2] = genPrivateKey().toString();

    // Verify that its valid on chain
    const isValidOnChain = await withdrawVerifierContract.verifyProof(
      solidityProof.a,
      solidityProof.b,
      solidityProof.c,
      solidityProof.inputs
    );
    expect(isValidOnChain).toEqual(false);

    done();
  });
});
