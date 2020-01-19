/* tslint:disable:ts(2363) */

import * as assert from 'assert'
import * as crypto from 'crypto'

import { babyJub, eddsa, mimcsponge } from 'circomlib'
import { bigInt, bn128 } from 'snarkjs'

import { snarkBigInt, PrivateKey, Publickey } from '../types/primitives'

export const SNARK_FIELD_SIZE: snarkBigInt = bigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')

export const bigInt2Buffer = (i: snarkBigInt): Buffer => {
  return Buffer.from(i.toString(16))
}

export const buffer2BigInt = (b: Buffer): snarkBigInt => {
  return bigInt('0x' + b.toString('hex'))
}

export const multiHash = (d: snarkBigInt[]): snarkBigInt => {
  return mimcsponge.multiHash(d)
}

export const hash = (d: snarkBigInt): snarkBigInt => {
  return multiHash([d])
}

export const genPrivateKey = (): PrivateKey => {
  // Check whether we are using the correct value for SNARK_FIELD_SIZE
  assert(SNARK_FIELD_SIZE.eq(bn128.r))

  // Prevent modulo bias
  const twoTwoFiftySix: snarkBigInt = bigInt(2).pow(bigInt(256))
  const min = twoTwoFiftySix.sub(SNARK_FIELD_SIZE).mod(SNARK_FIELD_SIZE)

  let rand: snarkBigInt = bigInt('0x' + crypto.randomBytes(32).toString('hex'))
  while (rand >= min) {
    rand = bigInt('0x' + crypto.randomBytes(32).toString('hex'))
  }

  const privKey: snarkBigInt = rand.mod(SNARK_FIELD_SIZE)
  assert(privKey < SNARK_FIELD_SIZE)
  return privKey
}

export const formatPrivKeyForBabyJub = (privKey: PrivateKey) => {
  /*
  * Formats a random private key to be compatible with the BabyJub curve.
  * This function needs to be called before passing into the snark circuit
  */

  // https://tools.ietf.org/html/rfc8032
  // Because of the "buff[0] & 0xF8" part which makes sure you have a point
  // with order that 8 divides (^ pruneBuffer)
  // Every point in babyjubjub is of the form: aP + bH, where H has order 8
  // and P has a big large prime order
  // Guaranteeing that any low order points in babyjubjub get deleted
  const sBuff = eddsa.pruneBuffer(
    bigInt2Buffer(hash(privKey)).slice(0, 32)
  )

  return bigInt.leBuff2int(sBuff).shr(3)
}

export const genPublicKey = (privKey: PrivateKey): Publickey => {
  assert(privKey < SNARK_FIELD_SIZE)

  return babyJub.mulPointEscalar(
    babyJub.Base8,
    formatPrivKeyForBabyJub(privKey)
  )
}
