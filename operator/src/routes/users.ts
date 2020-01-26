import { bigInt } from "snarkjs";

import { getRollUpContract } from "../utils/env";
import { multiHash } from "../utils/crypto";
import { stringifyBigInts, unstringifyBigInts } from "../utils/helpers";

const rollUpContract = getRollUpContract();

export const userAddressRoute = async (req, res) => {
  const { userAddress } = req.params;

  try {
    bigInt(userAddress, 16);
  } catch {
    res.send({ error: "Invalid user address" }).status(400);
    return;
  }

  const userData = await rollUpContract.getUserData(
    bigInt(userAddress, 16).toString()
  );
  const userDataArr = stringifyBigInts(userData);
  const publicKey = unstringifyBigInts([userDataArr[1], userDataArr[2]]);
  const address =
    publicKey[0].toString() === "0"
      ? "0"
      : "0x" + multiHash(publicKey).toString(16);

  res
    .send({
      index: userDataArr[0],
      publicKey: stringifyBigInts(publicKey),
      address,
      balance: userDataArr[3],
      nonce: userDataArr[4]
    })
    .status(200);
};

export const userIndexRoute = async (req, res) => {
  const { userIndex } = req.params;

  try {
    parseInt(userIndex);
  } catch {
    res.send({ error: "User index needs to be a number" }).status(400);
    return;
  }

  try {
    const userAddress = await rollUpContract.getUserKey(
      parseInt(userIndex).toString()
    );
    const userData = await rollUpContract.getUserData(userAddress.toString());
    const userDataArr = stringifyBigInts(userData);
    const publicKey = unstringifyBigInts([userDataArr[1], userDataArr[2]]);
    const address =
      publicKey[0].toString() === "0"
        ? "0"
        : "0x" + multiHash(publicKey).toString(16);

    res
      .send({
        index: userDataArr[0],
        publicKey: stringifyBigInts(publicKey),
        address,
        balance: userDataArr[3],
        nonce: userDataArr[4]
      })
      .status(200);
  } catch {
    res.send({ error: "Invalid index" }).status(400);
  }
};
