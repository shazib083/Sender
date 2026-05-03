import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    "arc-testnet": {
      url: process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL ?? "https://rpc.arc-testnet.network",
      chainId: parseInt(process.env.NEXT_PUBLIC_ARC_TESTNET_CHAIN_ID ?? "12321", 10),
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
};

export default config;
