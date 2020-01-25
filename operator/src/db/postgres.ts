import { Pool } from "pg";

import { getPgCredentials } from "../utils/env";
import { SnarkBigInt } from "../types/primitives";
import { createMerkleTree, saveMerkleTreeToDb } from "../utils/merkletree";

const { User, Password, Host, Port, Database } = getPgCredentials();

export const pgPool = new Pool({
  connectionString: `postgres://${User}:${Password}@${Host}:${Port}/${Database}`
});

export const initPg = async () => {
  // Merkle Tree
  try {
    await pgPool.query("SELECT * FROM merkletrees LIMIT 1;");
  } catch (e) {
    await pgPool.query(`
      CREATE TABLE merkletrees (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        depth INTEGER NOT NULL,
        next_index INTEGER NOT NULL,
        root TEXT NOT NULL,
        zero_value TEXT NOT NULL,
        zeros JSONB NOT NULL,
        filled_sub_trees JSONB NOT NULL,
        filled_paths JSONB NOT NULL
      );
    `);
  }

  // Merkle Tree (leaf value)
  try {
    await pgPool.query("SELECT * FROM leaves LIMIT 1;");
  } catch (e) {
    // public_key is the user's public key used to
    // encrypt the data in `data` column (with a structure of { data: BigInt[] })
    await pgPool.query(`
      CREATE TABLE leaves (
        merkletree_id INTEGER REFERENCES merkletrees(id),
        index INTEGER NOT NULL,
        raw JSONB NOT NULL,
        hash TEXT NOT NULL,
        CONSTRAINT same_tree_unique_idx UNIQUE (merkletree_id, index)
      );
    `);
  }
};

export const initMerkleTree = async (
  name: string,
  depth: number,
  zeroValue: SnarkBigInt
) => {
  // Create a merkle tree with the balance tree name
  // if it doesn't exist
  const mtTreeRes = await pgPool.query({
    text: "SELECT * FROM merkletrees WHERE name = $1 LIMIT 1;",
    values: [name]
  });
  if (mtTreeRes.rows.length === 0) {
    const m = createMerkleTree(depth, zeroValue);
    await saveMerkleTreeToDb(pgPool, name, m);
  }
};
