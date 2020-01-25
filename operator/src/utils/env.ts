import { EnvType, ContractAddresses, PgCredentials } from "../types/env";

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

  const deployedAddresses = require("../../../contracts/build/DeployedAddresses.json");
  return {
    BalanceTreeAddress: deployedAddresses.balanceTreeAddress,
    RollUpAddress: deployedAddresses.rollUpAddress
  };
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
