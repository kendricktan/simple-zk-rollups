import * as assert from "assert";
import * as crypto from "crypto";

import { mimc7, babyJub, eddsa, mimcsponge } from "circomlib";
import { bigInt, bn128 } from "snarkjs";

import {
  SnarkBigInt,
  EncryptedMessage,
  PrivateKey,
  Publickey,
  Message
} from "../types/primitives";
import { Signature } from "../types/models";

export const SNARK_FIELD_SIZE: SnarkBigInt = bigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

const bigInt2Buffer = (i: SnarkBigInt): Buffer => {
  return Buffer.from(i.toString(16));
};

const buffer2BigInt = (b: Buffer): SnarkBigInt => {
  return bigInt("0x" + b.toString("hex"));
};

export const multiHash = (d: SnarkBigInt[]): SnarkBigInt => {
  return mimcsponge.multiHash(d);
};

export const hash = (d: SnarkBigInt): SnarkBigInt => {
  return multiHash([d]);
};

export const hashLeftRight = (l: SnarkBigInt, r: SnarkBigInt): SnarkBigInt => {
  return multiHash([l, r]);
};

export const genPrivateKey = (): PrivateKey => {
  // Check whether we are using the correct value for SNARK_FIELD_SIZE
  assert(SNARK_FIELD_SIZE.eq(bn128.r));

  // Prevent modulo bias
  const twoTwoFiftySix: SnarkBigInt = bigInt(2).pow(bigInt(256));
  const min = twoTwoFiftySix.sub(SNARK_FIELD_SIZE).mod(SNARK_FIELD_SIZE);

  let rand: SnarkBigInt = bigInt("0x" + crypto.randomBytes(32).toString("hex"));
  while (rand >= min) {
    rand = bigInt("0x" + crypto.randomBytes(32).toString("hex"));
  }

  const privKey: SnarkBigInt = rand.mod(SNARK_FIELD_SIZE);
  assert(privKey < SNARK_FIELD_SIZE);
  return privKey;
};

export const formatPrivKeyForBabyJub = (privKey: PrivateKey): PrivateKey => {
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
  const sBuff: Buffer = eddsa.pruneBuffer(
    bigInt2Buffer(hash(privKey)).slice(0, 32)
  );

  // shr = Shift right
  return bigInt.leBuff2int(sBuff).shr(3);
};

export const genPublicKey = (privKey: PrivateKey): Publickey => {
  assert(privKey < SNARK_FIELD_SIZE);

  return babyJub
    .mulPointEscalar(babyJub.Base8, formatPrivKeyForBabyJub(privKey))
    .map(x => x.mod(SNARK_FIELD_SIZE));
};

export const ecdh = (priv: PrivateKey, pub: Publickey): PrivateKey => {
  // Performs a diffie-hellman to get shared keys
  const s = formatPrivKeyForBabyJub(priv);

  const k: Publickey = babyJub.mulPointEscalar(pub, s);

  return k[0];
};

export const encrypt = (
  msg: SnarkBigInt[],
  priv: PrivateKey
): EncryptedMessage => {
  // Initialization vector
  const iv = mimc7.multiHash(msg, bigInt(0));

  return {
    iv,
    msg: msg.map(
      (e: SnarkBigInt, i: number): SnarkBigInt => {
        return e + mimc7.hash(priv, iv + bigInt(i));
      }
    )
  };
};

export const decrypt = (
  encMsg: EncryptedMessage,
  priv: PrivateKey
): Message => {
  const { iv, msg } = encMsg;

  return msg.map(
    (e: SnarkBigInt, i: number): SnarkBigInt => {
      return e.sub(mimc7.hash(priv, iv + bigInt(i)));
    }
  );
};

export const ecdhEncrypt = (
  msg: SnarkBigInt[],
  priv: PrivateKey,
  pub: Publickey
): EncryptedMessage => {
  const sharedKey = ecdh(priv, pub);
  return encrypt(msg, sharedKey);
};

export const ecdhDecrypt = (
  encMsg: EncryptedMessage,
  priv: PrivateKey,
  pub: Publickey
): Message => {
  const sharedKey = ecdh(priv, pub);
  return decrypt(encMsg, sharedKey);
};

export const sign = (prv: SnarkBigInt, msg: Message): Signature => {
  const msgHash = multiHash(msg);

  // Signs a message
  const h1 = bigInt2Buffer(hash(prv));
  const sBuff = eddsa.pruneBuffer(h1.slice(0, 32));
  const s: SnarkBigInt = bigInt.leBuff2int(sBuff);
  const A: SnarkBigInt = babyJub.mulPointEscalar(babyJub.Base8, s.shr(3));

  const msgBuff: Buffer = bigInt.leInt2Buff(msgHash, 32);

  const rBuff = bigInt2Buffer(
    hash(buffer2BigInt(Buffer.concat([h1.slice(32, 64), msgBuff])))
  );

  let r = bigInt.leBuff2int(rBuff);
  r = r.mod(babyJub.subOrder);
  const R8 = babyJub.mulPointEscalar(babyJub.Base8, r);
  const hm = multiHash([R8[0], R8[1], A[0], A[1], msgHash]);
  const S = r.add(hm.mul(s)).mod(babyJub.subOrder);

  return {
    R8: R8,
    S: S
  };
};

export const verify = (
  msg: SnarkBigInt[],
  sig: Signature,
  pubKey: Publickey
): Boolean => {
  const msgHash = multiHash(msg);
  return eddsa.verifyMiMCSponge(msgHash, sig, pubKey);
};
