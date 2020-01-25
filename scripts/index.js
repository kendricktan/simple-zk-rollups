const { ethers } = require("ethers");

const { sign } = require("../operator/build/operator/src/utils/crypto");
const { formatTx } = require("../operator/build/operator/src/utils/helpers");

if (process.argv.length !== 3) {
  console.log(
    "node index.js [depositA|depositB|withdrawA|withdrawB|sendFromA|sendFromB]"
  );
  process.exit(-1);
}

const command = process.argv[2];

if (
  command !== "depositA" &&
  command !== "depositB" &&
  command !== "withdrawA" &&
  command !== "withdrawB" &&
  command !== "sendFromA" &&
  command !== "sendFromB"
) {
  console.log(
    "node index.js [depositA|depositB|withdrawA|withdrawB|sendFromA|sendFromB]"
  );
  process.exit(-1);
}

const rollUpDef = require("../contracts/build/contracts/RollUp.json");
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

const privB = 5571822240978976287981822894726063023722101866275711251367830831352258921143n;
const pubB = [
  4025550775190773106752472098712957308229408014044167272309204873490588345430n,
  5371429479583552729106435801902737969088445564732204620785902601809639523307n
];

const eth2Wei = n => {
  return ethers.utils.parseEther(n.toString());
};
const eth2WeiHex = n => {
  return "0x" + BigInt(ethers.utils.parseEther(n.toString())).toString(16);
};

const f = async () => {
  if (command === "depositA") {
    await rollUpContract.deposit(pubA[0].toString(), pubA[1].toString(), {
      value: eth2WeiHex(1.0)
    });
  }

  if (command === "depositB") {
    await rollUpContract.deposit(pubB[0].toString(), pubB[1].toString(), {
      value: eth2WeiHex(1.0)
    });
  }

  if (command === "withdrawA") {
    await rollUpContract.withdraw(
      pubA[0].toString(),
      pubA[1].toString(),
      eth2Wei(1.0).toString()
    );
  }

  if (command === "withdrawB") {
    await rollUpContract.withdraw(
      pubB[0].toString(),
      pubB[1].toString(),
      eth2Wei(1.0).toString()
    );
  }
};

f();
