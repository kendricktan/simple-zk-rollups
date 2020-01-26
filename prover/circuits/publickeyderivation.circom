include "./hasher.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";

template PublicKeyDerivation() {
  // Note: private key
  // Needs to be hashed, and then pruned before
  // supplying it to the circuit
  signal private input privateKey;
  signal output publicKey[2];

  component privBits = Num2Bits(253);
  privBits.in <== privateKey;

  var BASE8 = [
    5299619240641551281634865583518297030282874472190772894086521144482721001553,
    16950150798460657717958625567821834550301663161624707787222815936182638968203
  ];

  component mulFix = EscalarMulFix(253, BASE8);
  for (var i = 0; i < 253; i++) {
    mulFix.e[i] <== privBits.out[i];
  }

  publicKey[0] <== mulFix.out[0];
  publicKey[1] <== mulFix.out[1];
}