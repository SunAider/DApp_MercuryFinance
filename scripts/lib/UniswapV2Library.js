const { ethers } = require("hardhat");

async function main() {
    const [owner, userWallet] = await ethers.getSigners();

    console.log('owner address', owner.address);
    /**************
     * Mercury
     * *************/
    const UniswapV2 = await ethers.getContractFactory("UniswapV2Library");
    const uniswapV2 = await UniswapV2.deploy();

    console.log("UniswapV2 address:", uniswapV2.address);

    const factory = "0x9c83dCE8CA20E9aAF9D3efc003b2ea62aBC08351";
    const mecury = "0x17038aD4174029B886Cc1AD1cc0976067DEF34F1";
    const fantom = "0x4E15361FD6b4BB609Fa63C81A2be19d873717870";

    const pair = await uniswapV2.pairFor(factory, mecury, fantom);

    console.log("Pair Address of mecury and fantom", pair);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });