const { ethers } = require("ethers");

const rollUpDef = require("../contracts/build/contracts/RollUp.json");
const merkleTreeDef = require("../contracts/build/contracts/MerkleTree.json");
const deployedAddresses = require("../contracts/build/DeployedAddresses.json");

const provider = new ethers.providers.JsonRpcProvider();
const wallet = new ethers.Wallet(
  "0x94a9f52a9ef7933f3865a91766cb5e12d25f62d6aecf1d768508d95526bfee29",
  provider
);

const rollUpContract = new ethers.Contract(
  deployedAddresses.rollUpAddress,
  rollUpDef.abi,
  wallet
);
const privA = 4884893312420666846728788329068334659645814268254376926932808574485660215402n;

const pubA = [
  1503249839729450699258568253188655641897688629727284476088280559686550009373n,
  5002035132060692260001110027450125171390191669020671174899856008595079807949n
];

const f = async () => {
  await rollUpContract.deposit(pubA[0].toString(), pubA[1].toString(), {
    value: "0x" + BigInt(ethers.utils.parseEther((1.0).toString())).toString(16)
  });
};

f();
