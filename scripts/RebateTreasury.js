const { ethers } = require("hardhat");

async function main() {

    console.log("====================Rebate Treasury====================");

    /**************
     * RebateTreasury
     * *************/
    const mry = "0x2187aa20ad6A2bc4eB822d90eDD048640b84c404"; //address
    const oracle = "0xE4EFD87ad34360932E5325D77A0a6e39147DEbFa"; //address
    const treasury = "0x366e4E1A9606AF8C73E1A18f6A4F1DA7d4f5829F"; //address

    const RebateTreasury = await ethers.getContractFactory("RebateTreasury");
    const rebateTreasury = await RebateTreasury.deploy(mry, oracle, treasury);

    console.log("RebateTreasury address:", rebateTreasury.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });