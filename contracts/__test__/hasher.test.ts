import { deployCircomLib, deployHasher } from "./common";
import { multiHash, genPrivateKey } from "../../operator/src/utils/crypto";

describe("Hasher.sol", () => {
  let circomLibContract;
  let hasherContract;

  beforeAll(async () => {
    circomLibContract = await deployCircomLib();
    hasherContract = await deployHasher(circomLibContract.address);
  });

  it("hashMulti", async () => {
    const d = [genPrivateKey(), genPrivateKey()];

    const a = multiHash(d);
    const b = await hasherContract.hashMulti(
      d.map(x => x.toString()),
      0 // key
    );

    expect(a.toString()).toEqual(b.toString());
  });
});
