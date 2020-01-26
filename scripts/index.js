const { ethers } = require("ethers");
const axios = require("axios");
const {
  sign,
  genPrivateKey,
  formatPrivKeyForBabyJub,
  SNARK_FIELD_SIZE
} = require("../operator/build/operator/src/utils/crypto");
const {
  formatTx,
  stringifyBigInts,
  unstringifyBigInts
} = require("../operator/build/operator/src/utils/helpers");

const path = require("path");
const compiler = require("circom");

const { Circuit, groth } = require("snarkjs");
const { buildBn128 } = require("websnark");
const {
  binarifyWitness,
  binarifyProvingKey
} = require("../operator/build/operator/src/utils/binarify");

const provingKey = require("../prover/build/withdrawProvingKey.json");
const verifyingKey = require("../prover/build/withdrawVerifyingKey.json");

const genWithdrawVerifierProof = async circuitInputs => {
  const circuitDef = await compiler(
    path.join(__dirname, "../prover/circuits/withdraw.circom")
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

if (process.argv.length !== 3) {
  console.log(
    "node index.js [depositA|depositB|withdrawA|withdrawB|sendFromA|sendFromB]"
  );
  process.exit(-1);
}

const command = process.argv[2];

if (
  command !== "depositA" &&
  command !== "depositB" &&
  command !== "withdrawA" &&
  command !== "withdrawB" &&
  command !== "sendFromA" &&
  command !== "sendFromB"
) {
  console.log(
    "node index.js [depositA|depositB|withdrawA|withdrawB|sendFromA|sendFromB]"
  );
  process.exit(-1);
}

const rollUpDef = require("../contracts/build/contracts/RollUp.json");
const deployedAddresses = require("../contracts/build/DeployedAddresses.json");

const provider = new ethers.providers.JsonRpcProvider();
const wallet = new ethers.Wallet(
  "0x94a9f52a9ef7933f3865a91766cb5e12d25f62d6aecf1d768508d95526bfee29",
  provider
);

const rollUpContract = new ethers.Contract(
  deployedAddresses.rollUpAddress,
  rollUpDef.abi,
  wallet
);
const privA = 4884893312420666846728788329068334659645814268254376926932808574485660215402n;
const pubA = [
  1503249839729450699258568253188655641897688629727284476088280559686550009373n,
  5002035132060692260001110027450125171390191669020671174899856008595079807949n
];

const privB = 5571822240978976287981822894726063023722101866275711251367830831352258921143n;
const pubB = [
  4025550775190773106752472098712957308229408014044167272309204873490588345430n,
  5371429479583552729106435801902737969088445564732204620785902601809639523307n
];

const eth2Wei = n => {
  return ethers.utils.parseEther(n.toString());
};
const eth2WeiHex = n => {
  return "0x" + BigInt(ethers.utils.parseEther(n.toString())).toString(16);
};

const f = async () => {
  if (command === "depositA") {
    await rollUpContract.deposit(pubA[0].toString(), pubA[1].toString(), {
      value: eth2WeiHex(1.0)
    });
  }

  if (command === "depositB") {
    await rollUpContract.deposit(pubB[0].toString(), pubB[1].toString(), {
      value: eth2WeiHex(1.0)
    });
  }

  if (command === "withdrawA") {
    const { solidityProof } = await genWithdrawVerifierProof({
      privateKey: formatPrivKeyForBabyJub(privA),
      nullifier: genPrivateKey()
    });

    await rollUpContract.withdraw(
      eth2Wei(0.95).toString(),
      solidityProof.a,
      solidityProof.b,
      solidityProof.c,
      solidityProof.inputs
    );
  }

  if (command === "withdrawB") {
    const { solidityProof } = await genWithdrawVerifierProof({
      privateKey: formatPrivKeyForBabyJub(privB),
      nullifier: genPrivateKey()
    });

    await rollUpContract.withdraw(
      eth2Wei(0.95).toString(),
      solidityProof.a,
      solidityProof.b,
      solidityProof.c,
      solidityProof.inputs
    );
  }

  if (command === "sendFromA") {
    // TODO: Get data from operator
    const txWithoutSig = {
      from: 0,
      to: 1,
      amount: eth2Wei(0.1),
      fee: eth2Wei(0.01),
      nonce: 1
    };
    const signature = sign(privA, formatTx(txWithoutSig));
    const tx = Object.assign({}, txWithoutSig, { signature });

    const a = await axios.post(
      "http://localhost:3000/send",
      stringifyBigInts(tx)
    );

    console.log(a.data);
  }
};

f();
