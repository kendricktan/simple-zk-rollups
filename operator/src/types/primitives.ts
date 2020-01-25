// The bigInt from snarkjs has some extensions to it
// i.e. leInt2Buff and beInt2Buff
export interface SnarkBigInt extends BigInt {
  isOdd: Function;
  isNegative: Function;
  and: Function;
  div: Function;
  mod: Function;
  pow: Function;
  abs: Function;
  modPow: Function;
  greaterOrEquals: Function;
  greater: Function;
  gt: Function;
  lesserOrEquals: Function;
  lesser: Function;
  lt: Function;
  equals: Function;
  eq: Function;
  neq: Function;
  toJSNumber: Function;
  affine: Function;
  inverse: Function;
  add: Function;
  sub: Function;
  neg: Function;
  mul: Function;
  shr: Function;
  shl: Function;
  square: Function;
  double: Function;
  isZero: Function;
  leInt2Buff: Function;
  beInt2Buff: Function;
}

export type PrivateKey = SnarkBigInt;
export type Publickey = [SnarkBigInt, SnarkBigInt];

export interface EncryptedMessage {
  iv: SnarkBigInt;
  msg: SnarkBigInt[];
}
export type Message = SnarkBigInt[];

export type Wei = SnarkBigInt;
