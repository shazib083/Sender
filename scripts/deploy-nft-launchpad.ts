const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account found. Add DEPLOYER_PRIVATE_KEY=0x... to .env, then run npm run deploy:nft-launchpad again."
    );
  }

  console.log("Deploying SenderNftLaunchpad with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const Launchpad = await ethers.getContractFactory("SenderNftLaunchpad");
  const launchpad = await Launchpad.deploy();
  await launchpad.waitForDeployment();

  const address = await launchpad.getAddress();
  console.log("\nSenderNftLaunchpad deployed to:", address);
  console.log("\nAdd this to your .env.local or .env:");
  console.log(`NEXT_PUBLIC_NFT_LAUNCHPAD_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
