const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account found. Add DEPLOYER_PRIVATE_KEY=0x... to .env, then run this deploy script again."
    );
  }

  console.log("Deploying MultiSend with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const MultiSend = await ethers.getContractFactory("MultiSend");
  const multisend = await MultiSend.deploy();
  await multisend.waitForDeployment();

  const address = await multisend.getAddress();
  console.log("\n✅ MultiSend deployed to:", address);
  console.log("\nAdd this to your .env.local:");
  console.log(`NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
