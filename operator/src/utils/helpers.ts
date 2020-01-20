import * as s from "snarkjs/src/stringifybigint";

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
