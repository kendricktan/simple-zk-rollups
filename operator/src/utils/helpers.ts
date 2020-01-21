import * as s from "snarkjs/src/stringifybigint";

import { ethers } from "ethers";
import { bigInt } from "snarkjs";

import { Transaction, SnarkBigInt, Wei } from "../types/primitives";
import { multiHash } from "./crypto";

export const copyObject = (a: any): any => {
  // Makes a copy of the object instead of writing over it
  return Object.assign(Object.create(Object.getPrototypeOf(a)), a);
};

export const stringifyBigInts = (a: any): any => {
  return s.stringifyBigInts(a);
};

export const unstringifyBigInts = (a: any): any => {
  return s.unstringifyBigInts(a);
};

export const stringify = (a: any): any => {
  return JSON.stringify(stringifyBigInts(a));
};

export const toWei = (e: number): Wei => {
  // Convert from eth to wei
  return bigInt(ethers.utils.parseEther(e.toString()));
};

export const formatTx = (tx: Transaction): SnarkBigInt[] => {
  return [
    tx.from,
    tx.to,
    tx.amount,
    tx.fee,
    tx.nonce,
    tx.signature !== undefined ? tx.signature.R8[0] : null,
    tx.signature !== undefined ? tx.signature.R8[1] : null,
    tx.signature !== undefined ? tx.signature.S : null
  ]
    .filter((x: any): Boolean => x !== null)
    .map((x: any): SnarkBigInt => bigInt(x));
};

export const serializeTx = (tx: Transaction): SnarkBigInt => {
  const txData = formatTx(tx);
  return multiHash(txData);
};
