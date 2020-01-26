include "./publickeyderivation.circom";
include "./hasher.circom";

template Withdraw() {
  signal private input privateKey;

  // Nullifier so people can't re-use proofs
  signal input nullifier;

  signal output publicKey[2];

  component pubKeyDerivation = PublicKeyDerivation();
  pubKeyDerivation.privateKey <== privateKey;

  component hasher = Hasher(3);
  hasher.key <== 0;
  hasher.in[0] <== pubKeyDerivation.publicKey[0];
  hasher.in[1] <== pubKeyDerivation.publicKey[1];
  hasher.in[2] <== nullifier;

  publicKey[0] <== pubKeyDerivation.publicKey[0];
  publicKey[1] <== pubKeyDerivation.publicKey[1];
}

component main = Withdraw()