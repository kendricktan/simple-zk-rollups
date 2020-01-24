pragma solidity 0.5.11;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./Hasher.sol";
import "./Whitelist.sol";
import "./MerkleTree.sol";

contract RollUp {
  using SafeMath for uint256;

  // Hasher function
  Hasher hasher;

  // Merkle Tree that represents all users's
  // deposits
  MerkleTree balanceTree;

  // Deposit event
  event Deposit(
    uint256 balanceTreeIndex,
    uint256 publicKeyX,
    uint256 publicKeyY,
    uint256 balance,
    uint256 nonce
  );

  // Withdraw
  event Withdraw(
    uint256 balanceTreeIndex,
    uint256 publicKeyX,
    uint256 publicKeyY,
    uint256 balance,
    uint256 nonce
  );

  // Registered users
  struct User {
    uint256 balanceTreeLeafIndex;
    uint256 publicKeyX;
    uint256 publicKeyY;
    uint256 balance;
    uint256 nonce;
  }
  mapping(uint256 => User) balanceTreeUsers;
  mapping(uint256 => bool) isPublicKeysRegistered;

  constructor(address balanceTreeAddress, address hasherAddress) public {
    balanceTree = MerkleTree(balanceTreeAddress);
    hasher = Hasher(hasherAddress);
  }

  // Checks if public key is registered
  function isRegistered(uint256 publicKeyX, uint256 publicKeyY)
    public
    view
    returns (bool)
  {
    uint256 publicKeyHash = hasher.hashPair(publicKeyX, publicKeyY);
    return isPublicKeysRegistered[publicKeyHash];
  }

  function getUserData(uint256 publicKeyX, uint256 publicKeyY)
    public
    view
    returns (uint256, uint256, uint256, uint256, uint256)
  {
    uint256 publicKeyHash = hasher.hashPair(publicKeyX, publicKeyY);

    User memory user = balanceTreeUsers[publicKeyHash];

    return (
      user.balanceTreeLeafIndex,
      user.publicKeyX,
      user.publicKeyY,
      user.balance,
      user.nonce
    );
  }

  function withdrawAll(uint256 publicKeyX, uint256 publicKeyY) public {
    uint256 publicKeyHash = hasher.hashPair(publicKeyX, publicKeyY);

    User memory user = balanceTreeUsers[publicKeyHash];

    if (user.balance <= 0) {
      revert("Cannot withdraw with 0 balance");
    }

    withdraw(publicKeyX, publicKeyY, user.balance);
  }

  function withdraw(uint256 publicKeyX, uint256 publicKeyY, uint256 amount)
    public
  {
    uint256 publicKeyHash = hasher.hashPair(publicKeyX, publicKeyY);

    User storage user = balanceTreeUsers[publicKeyHash];

    if (user.balance < amount) {
      revert("Withdraw amount is more than remaining balance");
    }

    user.balance -= amount;
    msg.sender.transfer(amount);

    emit Withdraw(
      user.balanceTreeLeafIndex,
      publicKeyX,
      publicKeyY,
      user.balance,
      user.nonce
    );
  }

  function deposit(uint256 publicKeyX, uint256 publicKeyY) public payable {
    uint256 publicKeyHash = hasher.hashPair(publicKeyX, publicKeyY);

    User storage user = balanceTreeUsers[publicKeyHash];
    user.balance += msg.value;

    // Insert user into balance tree
    uint256 leaf = hasher.hashBalanceTreeLeaf(
      publicKeyX,
      publicKeyY,
      user.balance,
      user.nonce
    );

    // If its a new user, mark them as registered,
    // and insert them into the merkleTree
    if (!isPublicKeysRegistered[publicKeyHash]) {
      isPublicKeysRegistered[publicKeyHash] = true;

      user.publicKeyX = publicKeyX;
      user.publicKeyY = publicKeyY;

      // Saves user's index in balance tree
      user.balanceTreeLeafIndex = balanceTree.getInsertedLeavesNo();
      balanceTree.insert(leaf);
    } else {
      // Updates balance and data in balance tree
      balanceTree.update(user.balanceTreeLeafIndex, leaf);
    }

    emit Deposit(
      user.balanceTreeLeafIndex,
      publicKeyX,
      publicKeyY,
      user.balance,
      user.nonce
    );
  }
}
