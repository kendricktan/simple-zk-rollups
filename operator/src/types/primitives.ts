export interface snarkBigInt extends BigInt {
    isOdd: Function,
    isNegative: Function,
    and: Function,
    div: Function,
    mod: Function,
    pow: Function,
    abs: Function,
    modPow: Function,
    greaterOrEquals: Function,
    greater: Function,
    gt: Function,
    lesserOrEquals: Function,
    lesser: Function,
    lt: Function,
    equals: Function,
    eq: Function,
    neq: Function,
    toJSNumber: Function,
    affine: Function,
    inverse: Function,
    add: Function,
    sub: Function,
    neg: Function,
    mul: Function,
    shr: Function,
    shl: Function,
    square: Function,
    double: Function,
    isZero: Function,
    leInt2Buff: Function,
    beInt2Buff: Function
}

export type PrivateKey = snarkBigInt
export type Publickey = [snarkBigInt, snarkBigInt]

export interface Signature {
  R8: [snarkBigInt, snarkBigInt],
  S: snarkBigInt
}