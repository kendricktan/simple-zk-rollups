/*
 * Hasher object to abstract out hashing logic
 * to be shared between multiple files
 *
 * Copyright (C) 2019 Kendrick Tan <kendricktan0814@gmail.com>
 *
 * This file is part of simple-zk-rollups
 * Everyone is permitted to copy and distribute verbatim or modified
 * copies of this license document, and changing it is allowed as long
 * as the name is changed.
 *           DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE
 *   TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION
 * 0. You just DO WHAT THE FUCK YOU WANT TO.
 */

pragma solidity 0.5.11;

library CircomLib {
  function MiMCSponge(uint256 xL_in, uint256 xR_in, uint256 k)
    public
    pure
    returns (uint256 xL, uint256 xR);
}

contract Hasher {
  function hashMulti(uint256[] memory array, uint256 key)
    public
    pure
    returns (uint256)
  {
    uint256 k = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 R = 0;
    uint256 C = 0;

    for (uint256 i = 0; i < array.length; i++) {
      R = addmod(R, array[i], k);
      (R, C) = CircomLib.MiMCSponge(R, C, key);
    }

    return R;
  }

  function hashPair(uint256 left, uint256 right) public pure returns (uint256) {
    uint256[] memory arr = new uint256[](2);
    arr[0] = left;
    arr[1] = right;

    return hashMulti(arr, 0);
  }

  function hashBalanceTreeLeaf(
    uint256 publicKeyX,
    uint256 publicKeyY,
    uint256 balance,
    uint256 nonce
  ) public pure returns (uint256) {
    uint256[] memory arr = new uint256[](4);
    arr[0] = publicKeyX;
    arr[1] = publicKeyY;
    arr[2] = balance;
    arr[3] = nonce;

    return hashMulti(arr, 0);
  }
}
