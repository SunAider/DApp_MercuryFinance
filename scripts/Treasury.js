const { ethers } = require("hardhat");

async function main() {

    console.log('Treasury Address Deploy');

    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy();

    console.log("Treasury address:", treasury.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });