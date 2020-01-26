pragma solidity 0.5.11;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "./Hasher.sol";
import "./Whitelist.sol";
import "./MerkleTree.sol";
import "./WithdrawVerifier.sol";

contract RollUp {
  using SafeMath for uint256;

  // Contract owner
  address owner;

  // Hasher function
  Hasher hasher;

  // Merkle Tree that represents all users's
  // deposits
  MerkleTree balanceTree;

  // ZK Proofs
  WithdrawVerifier withdrawVerifier;

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
  mapping(uint256 => address) balanceTreeOwners;
  mapping(uint256 => User) balanceTreeUsers;
  mapping(uint256 => bool) isPublicKeysRegistered;
  mapping(uint256 => bool) usedNullifiers;

  // index => hash(public key)
  mapping(uint256 => uint256) balanceTreeKeys;

  uint256 accuredFees;

  constructor(
    address hasherAddress,
    address balanceTreeAddress,
    address withdrawVerifierAddress
  ) public {
    owner = msg.sender;

    hasher = Hasher(hasherAddress);
    balanceTree = MerkleTree(balanceTreeAddress);
    withdrawVerifier = WithdrawVerifier(withdrawVerifierAddress);

    accuredFees = 0;
  }

  // Checks if public key is registered
  function isPublicKeyRegistered(uint256 publicKeyX, uint256 publicKeyY)
    public
    view
    returns (bool)
  {
    uint256 publicKeyHash = hasher.hashPair(publicKeyX, publicKeyY);
    return isPublicKeysRegistered[publicKeyHash];
  }

  function getUserKey(uint256 index) public view returns (uint256) {
    return balanceTreeKeys[index];
  }

  function getUserData(uint256 publicKeyHash)
    public
    view
    returns (uint256, uint256, uint256, uint256, uint256)
  {
    User memory user = balanceTreeUsers[publicKeyHash];

    return (
      user.balanceTreeLeafIndex,
      user.publicKeyX,
      user.publicKeyY,
      user.balance,
      user.nonce
    );
  }

  function withdrawAll(
    uint256[2] memory a,
    uint256[2][2] memory b,
    uint256[2] memory c,
    uint256[3] memory input
  ) public {
    // Inputs are the public signal
    uint256 publicKeyX = input[0];
    uint256 publicKeyY = input[1];

    uint256 publicKeyHash = hasher.hashPair(publicKeyX, publicKeyY);
    User memory user = balanceTreeUsers[publicKeyHash];
    if (user.balance <= 0) {
      revert("Cannot withdraw with 0 balance");
    }

    withdraw(user.balance, a, b, c, input);
  }

  function withdraw(
    uint256 amount,
    uint256[2] memory a,
    uint256[2][2] memory b,
    uint256[2] memory c,
    uint256[3] memory input
  ) public {
    // Inputs are the public signal
    uint256 publicKeyX = input[0];
    uint256 publicKeyY = input[1];
    uint256 nullifier = input[2];

    if (usedNullifiers[nullifier]) {
      revert("Nullifier has been used");
    }

    // Check if proof is valid
    bool validProof = withdrawVerifier.verifyProof(a, b, c, input);
    if (!validProof) {
      revert("Unauthorized to withdraw funds");
    }

    // CHeck user balance
    uint256 publicKeyHash = hasher.hashPair(publicKeyX, publicKeyY);
    User storage user = balanceTreeUsers[publicKeyHash];
    if (amount > user.balance) {
      revert("Withdraw amount is more than remaining balance");
    }

    // Register nullifier as used
    usedNullifiers[nullifier] = true;
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

      // Saves user's public key
      user.publicKeyX = publicKeyX;
      user.publicKeyY = publicKeyY;

      // Saves user's index in balance tree
      user.balanceTreeLeafIndex = balanceTree.getInsertedLeavesNo();
      balanceTree.insert(leaf);

      // Saves user's index in balanceTreeKeys
      balanceTreeKeys[user.balanceTreeLeafIndex] = publicKeyHash;

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

  function getAccuredFees() public view returns (uint256) {
    return accuredFees;
  }

  function withdrawAccuredFees() public {
    if (msg.sender != owner) {
      revert("Only owner can call this function");
    }
    msg.sender.transfer(accuredFees);
    accuredFees = 0;
  }
}
