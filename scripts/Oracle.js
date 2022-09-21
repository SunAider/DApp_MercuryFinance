const { ethers } = require("hardhat");

async function main() {

    console.log("====================Oracle====================");

    const pair = "0x7885e359a085372EbCF1ed6829402f149D02c600";
    const period = 3600;

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const startTime = blockBefore.timestamp;
    //const startTime = 1610323200;

    const Oracle = await ethers.getContractFactory("Oracle");
    const oracle = await Oracle.deploy(pair, period, startTime);
    //const oracle = await Oracle.deploy("0xd4405f0704621dbe9d4dea60e128e0c3b26bddbd", 3600, 1610323200);

    console.log("Oracle Address: ", oracle.address);
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });