include "./hasher.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";


template Ecdh() {
  // Note: private key
  // Needs to be hashed, and then pruned before
  // supplying it to the circuit
  signal private input privateKey;
  signal input publicKey[2];

  signal output sharedKey;

  component privBits = Num2Bits(253);
  privBits.in <== privateKey;

  component mulFix = EscalarMulAny(253);
  mulFix.p[0] <== publicKey[0];
  mulFix.p[1] <== publicKey[1];

  for (var i = 0; i < 253; i++) {
    mulFix.e[i] <== privBits.out[i];
  }

  sharedKey <== mulFix.out[0];
}
