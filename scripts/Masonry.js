const { ethers } = require("hardhat");

async function main() {

    console.log("====================Masonry====================");

    const Masonry = await ethers.getContractFactory("Masonry");
    const masonry = await Masonry.deploy();

    console.log("Masonry address:", masonry.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });