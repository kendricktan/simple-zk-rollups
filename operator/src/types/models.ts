import { Publickey, SnarkBigInt, Wei } from "./primitives";

export interface Signature {
  R8: [SnarkBigInt, SnarkBigInt];
  S: SnarkBigInt;
}

export interface BalanceTreeLeafData {
  publicKey: Publickey;
  balance: SnarkBigInt;
  nonce: number;
}

export interface Transaction {
  from: number;
  to: number;
  amount: Wei;
  fee: Wei;
  nonce: number;
  signature?: Signature;
}
