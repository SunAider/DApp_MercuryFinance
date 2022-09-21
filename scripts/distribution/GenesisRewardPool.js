const { ethers } = require("hardhat");

async function main() {

    console.log("====================Genesis Pool====================");

    const [owner, userWallet] = await ethers.getSigners();
    /**************
     * Genesis Pool
     * *************/
    const mry = "0x9b7F7E44904Bb61a9710685c938eA5f867Cb36b2"; //BB's  address
    //const shiba = userWallet.address; //address

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const startTime = blockBefore.timestamp;

    const poolStartTime = 1642896000; //uint256 1610323200

    const GenesisRewardPool = await ethers.getContractFactory("MryGenesisRewardPool");
    const genesisRewardPool = await GenesisRewardPool.deploy(mry, poolStartTime);

    console.log("GenesisRewardPool address:", genesisRewardPool.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });