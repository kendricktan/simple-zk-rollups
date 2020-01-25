import {
  EnvType,
  ContractAddresses,
  PgCredentials,
  RedisCredentials
} from "../types/env";
import { ethers } from "ethers";

import * as rollUpDef from "../../../contracts/build/contracts/RollUp.json";
import * as merkleTreeDef from "../../../contracts/build/contracts/MerkleTree.json";
import * as deployedAddresses from "../../../contracts/build/DeployedAddresses.json";

export const getEnvType = (): EnvType => {
  const v = process.env.ENV_TYPE;
  if (v === "DEBUG") {
    return EnvType.Debug;
  } else if (v === "DEV") {
    return EnvType.Dev;
  } else if (v === "PROD") {
    return EnvType.Prod;
  }
  // Dev by default
  return EnvType.Dev;
};

export const getContractAddresses = (): ContractAddresses => {
  const envType: EnvType = getEnvType();

  // Only prod requires manually specifying the addresses
  if (envType === EnvType.Prod) {
    if (
      process.env.BALANCE_TREE_ADDRESS === undefined ||
      process.env.ROLL_UP_ADDRESS === undefined
    ) {
      throw new Error(
        "ENV_TYPE = PROD, however BALANCE_TREE_ADDRESS and/or ROLL_UP_ADDRESS is not specified"
      );
    }

    return {
      BalanceTreeAddress: process.env.BALANCE_TREE_ADDRESS,
      RollUpAddress: process.env.ROLL_UP_ADDRESS
    };
  }

  return {
    BalanceTreeAddress: deployedAddresses.balanceTreeAddress,
    RollUpAddress: deployedAddresses.rollUpAddress
  };
};

export const getWeb3Wallet = (): ethers.Wallet => {
  const envType: EnvType = getEnvType();

  const providerUrl = process.env.WEB3_PROVIDER_URL;
  const web3PrivateKey = process.env.WEB3_PRIVATE_KEY;

  // Only prod requires manually specifying the addresses
  if (envType === EnvType.Prod) {
    if (web3PrivateKey === undefined || providerUrl === undefined) {
      throw new Error(
        "ENV_TYPE = PROD, however WEB3_PRIVATE_KEY and/or WEB3_PROVIDER_URL is not specified"
      );
    }

    const provider = new ethers.providers.JsonRpcProvider(providerUrl);
    return new ethers.Wallet(web3PrivateKey, provider);
  }

  const provider = new ethers.providers.JsonRpcProvider(
    providerUrl === undefined ? "http://localhost:8545" : providerUrl
  );
  return new ethers.Wallet(
    web3PrivateKey === undefined
      ? "0x94a9f52a9ef7933f3865a91766cb5e12d25f62d6aecf1d768508d95526bfee29"
      : web3PrivateKey,
    provider
  );
};

export const getRollUpContract = (): ethers.Contract => {
  const { RollUpAddress } = getContractAddresses();
  const wallet = getWeb3Wallet();

  //@ts-ignore
  return new ethers.Contract(RollUpAddress, rollUpDef.abi, wallet);
};

export const getBalanceTreeContract = (): ethers.Contract => {
  const { BalanceTreeAddress } = getContractAddresses();
  const wallet = getWeb3Wallet();

  //@ts-ignore
  return new ethers.Contract(BalanceTreeAddress, merkleTreeDef.abi, wallet);
};

export const getPgCredentials = (): PgCredentials => {
  const envType: EnvType = getEnvType();

  const User = process.env.PG_USER;
  const Password = process.env.PG_PASSWORD;
  const Host = process.env.PG_HOST;
  const Port = process.env.PG_PORT;
  const Database = process.env.PG_DB;

  // Only prod requires manually specifying the addresses
  if (envType === EnvType.Prod) {
    if (
      User === undefined ||
      Password === undefined ||
      Host === undefined ||
      Port === undefined ||
      Database === undefined
    ) {
      throw new Error(
        "ENV_TYPE = PROD, however PG_USER, PG_PASSWORD, PG_HOST, PG_PORT, and/or PG_DB is not specified"
      );
    }

    return {
      User,
      Password,
      Host,
      Port,
      Database
    };
  }

  return {
    User: User || "simplezkrollups",
    Password: Password || "simplezkrollups",
    Host: Host || "127.0.0.1",
    Port: Port || "5432",
    Database: "simplezkrollups"
  };
};

export const getRedisCredentials = (): RedisCredentials => {
  const envType: EnvType = getEnvType();

  const Host = process.env.REDIS_HOST;
  const Port = process.env.REDIS_PORT;
  const Password = process.env.REDIS_PASSWORD;

  // Only prod requires manually specifying the addresses
  if (envType === EnvType.Prod) {
    if (Password === undefined || Host === undefined || Port === undefined) {
      throw new Error(
        "ENV_TYPE = PROD, however REDIS_HOST, REDIS_PORT, and/or REDIS_PASSWORD is not specified"
      );
    }

    return {
      Host,
      Port,
      Password
    };
  }

  return {
    Host: Host || "127.0.0.1",
    Port: Port || "6379",
    Password: Password || "simplezkrollups"
  };
};
