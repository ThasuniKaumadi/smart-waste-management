const hre = require("hardhat");

async function main() {
  console.log("Deploying WasteManagement contract...");

  const WasteManagement = await hre.ethers.getContractFactory("WasteManagement");
  const wasteManagement = await WasteManagement.deploy();

  await wasteManagement.waitForDeployment();

  const address = await wasteManagement.getAddress();
  console.log("WasteManagement deployed to:", address);
  console.log("Save this address! Add it to your .env.local file as:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});