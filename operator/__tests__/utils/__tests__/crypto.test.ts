import {
  genPrivateKey,
  genPublicKey,
  ecdh,
  encrypt,
  decrypt,
  ecdhEncrypt,
  ecdhDecrypt,
  sign,
  verify
} from "../../src/utils/crypto";

describe("crypto.ts", () => {
  const privA = genPrivateKey();
  const pubA = genPublicKey(privA);

  const privB = genPrivateKey();
  const pubB = genPublicKey(privB);

  const msg = [0, 0, 0, 0, 0].map(() => genPrivateKey());

  it("ecdh", () => {
    const sk1 = ecdh(privA, pubB);
    const sk2 = ecdh(privB, pubA);

    expect(sk1.toString()).toEqual(sk2.toString());
  });

  it("encrypt, decrypt", () => {
    const encMsg = encrypt(msg, privA);
    const decMsg = decrypt(encMsg, privA);

    for (let i = 0; i < decMsg.length; i++) {
      expect(decMsg[i].toString()).toEqual(msg[i].toString());
    }
  });

  it("ecdhEncrypt, ecdhDecrypt", () => {
    const encMsg1 = ecdhEncrypt(msg, privA, pubB);
    const encMsg2 = ecdhEncrypt(msg, privB, pubA);

    expect(encMsg1.iv.toString()).toEqual(encMsg2.iv.toString());
    for (let i = 0; i < encMsg1.msg.length; i++) {
      expect(encMsg1.msg[i].toString()).toEqual(encMsg2.msg[i].toString());
    }

    const decMsg1 = ecdhDecrypt(encMsg1, privA, pubB);
    const decMsg2 = ecdhDecrypt(encMsg1, privB, pubA);

    for (let i = 0; i < decMsg1.length; i++) {
      expect(msg[i].toString()).toEqual(decMsg1[i].toString());
      expect(decMsg1[i].toString()).toEqual(decMsg2[i].toString());
    }
  });

  it("Sign and Verify", () => {
    const signature = sign(privA, msg);
    const isValid = verify(msg, signature, pubA);
    expect(isValid).toEqual(true);

    const isInvalid = verify(msg, signature, pubB);
    expect(isInvalid).toEqual(false);
  });
});
