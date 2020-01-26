import { bigInt } from "snarkjs";

import * as config from "../../../zk-rollups.config";

import { redisGet, redisSet } from "../db/redis";
import { verify } from "../utils/crypto";
import { formatTx, stringify, unstringifyBigInts } from "../utils/helpers";
import { pgPool } from "../db/postgres";
import { loadMerkleTreeFromDb } from "../utils/merkletree";
import { SnarkBigInt } from "../types/primitives";
import { BalanceTreeLeafData, Signature, Transaction } from "../types/models";

const balanceTreeName = config.balanceTree.name;
const redisLastInsertedTxKey = config.redis.lastInsertedKey;

export const sendRoute = async (req, res) => {
  const { from, to, fee, amount, nonce, signature } = req.body;

  const errResp = {
    error: "Missing parameters",
    from: "(required) int",
    to: "(required) int",
    amount: "(required) int, in Wei",
    fee: "(required) int, in Wei (min 0.3% of amount)",
    nonce: "(required) int",
    signature: {
      R8: "(required) [int, int]",
      S: "(required) int"
    }
  };

  if (
    from === undefined ||
    to === undefined ||
    amount === undefined ||
    nonce === undefined ||
    signature === undefined ||
    !Array.isArray(signature.R8) ||
    signature.S === undefined
  ) {
    res
      .send(Object.assign(errResp, { error: "Missing parameters" }))
      .status(400);
    return;
  }

  // Fee is 0.3% of the tx
  let bfrom: number;
  let bto: number;
  let bamount: SnarkBigInt;
  let bfee: SnarkBigInt;
  let bnonce: number;
  let bsignature: Signature;
  try {
    bfrom = parseInt(from);
    bto = parseInt(to);
    bamount = bigInt(amount);
    bfee = bigInt(fee);
    bnonce = parseInt(nonce);
    bsignature = unstringifyBigInts(signature);
  } catch {
    res
      .send(
        Object.assign(errResp, {
          error: "Invalid paramters, unable to convert to Integers!"
        })
      )
      .status(400);
    return;
  }

  // Loads merkle tree from database
  const m = await loadMerkleTreeFromDb(pgPool, balanceTreeName);

  // If sender doesn't exist in the tree, throw error
  if (bfrom >= m.nextLeafIndex) {
    res.send({ error: "Sender (from) not found" }).status(400);
    return;
  }

  // If receiver doesn't exist in the tree, throw error
  if (bto >= m.nextLeafIndex) {
    res.send({ error: "Sender (to) not found" }).status(400);
    return;
  }

  // Get sender data
  const senderData: BalanceTreeLeafData = m.getLeafRaw(bfrom);

  // If sender is trying to send > balance, ignore
  if (senderData.balance < bamount) {
    res
      .send({
        error: `Sender only has ${senderData.balance.toString()}, unable to send ${bamount.toString()}`
      })
      .status(400);
    return;
  }

  // If fee isn't at least 0.3% of the balance amount, ignore
  const minFee = bamount.div(bigInt(1000)).mul(bigInt(3));
  if (minFee.gt(bfee)) {
    res
      .send({
        error: `Fee needs to be at least 0.3% of the amount to be sent`
      })
      .status(400);
    return;
  }

  // Validate nonce
  if (bnonce != parseInt(senderData.nonce.toString()) + 1) {
    res
      .send({
        error: `Expected nonce of ${senderData.nonce +
          1}, received ${bnonce.toString()}`
      })
      .status(400);
    return;
  }

  // Construct transaction
  const txWithoutSig: Transaction = {
    from: bfrom,
    to: bto,
    amount: bamount,
    fee,
    nonce: bnonce
  };

  // Validate signature
  if (!verify(formatTx(txWithoutSig), bsignature, senderData.publicKey)) {
    res.send({ error: `Invalid signature` }).status(400);
    return;
  }

  // Save transaction to redis
  const tx: Transaction = Object.assign({}, txWithoutSig, {
    signature: bsignature
  });

  let lastInsertedTx = await redisGet(redisLastInsertedTxKey);
  if (lastInsertedTx === null) {
    lastInsertedTx = 0;
  }
  await redisSet(lastInsertedTx, stringify(tx));
  await redisSet(redisLastInsertedTxKey, lastInsertedTx + 1);

  res.send({ status: "Transaction accepted" }).status(201);
};
