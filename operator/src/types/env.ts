export enum EnvType {
  Debug = 0,
  Dev = 1,
  Prod = 2
}

export interface ContractAddresses {
  RollUpAddress: string;
  BalanceTreeAddress: string;
}

export interface PgCredentials {
  User: string;
  Password: string;
  Host: string;
  Port: string;
  Database: string;
}

export interface RedisCredentials {
  Host: string;
  Port: string;
  Password: string;
}
