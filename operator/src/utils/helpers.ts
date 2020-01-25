import * as s from "snarkjs/src/stringifybigint";

import { ethers } from "ethers";
import { bigInt } from "snarkjs";

import { SnarkBigInt, Wei } from "../types/primitives";
import { Transaction, BalanceTreeLeafData } from "../types/models";
import { multiHash } from "./crypto";

export const copyObject = (a: any): any => {
  if (Array.isArray(a)) {
    return Array.from(a);
  }
  // Makes a copy of the object instead of writing over it
  return Object.assign(
    Object.create(Object.getPrototypeOf(a)),
    unstringifyBigInts(stringifyBigInts(a))
  );
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

export const unstringify = (a: any): any => {
  return JSON.parse(unstringifyBigInts(a));
};

export const toWei = (e: number): Wei => {
  // Convert from eth to wei
  return bigInt(ethers.utils.parseEther(e.toString()));
};

export const toWeiHex = (e: number): String => {
  return "0x" + toWei(e).toString(16);
};

export const fromWei = (w: Wei): number => {
  return parseFloat(ethers.utils.formatEther(w.toString()));
};

export const randomRange = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const randomItem = (a: any[]): any => {
  return a[Math.floor(Math.random() * a.length)];
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

export const hashBalanceTreeLeaf = (a: BalanceTreeLeafData): SnarkBigInt => {
  return multiHash([...a.publicKey, a.balance, bigInt(a.nonce)]);
};
