const { ethers } = require("hardhat");

async function main() {

    const [owner, userWallet] = await ethers.getSigners();

    /**************
     * MRY

    * *************/

    console.log("====================MRY====================");

    const taxCollector = owner.address;
    const taxRate = 0;

    const MRY = await ethers.getContractFactory("MRY");
    const mry = await MRY.deploy(taxRate, taxCollector);

    const totalAmtMry = 100000000;

    console.log("MRY Token address:", mry.address);

    // await mry.mint(owner.address, totalAmtMry);

    // const balanceOfOwner = await mry.balanceOf(owner.address);

    // console.log(balanceOfOwner);

    /**************
     * XSHARE
     * *************/

    console.log("====================XSHARE====================");

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const startTime = blockBefore.timestamp;

    const XShare = await ethers.getContractFactory("XShare");
    const xShare = await XShare.deploy(startTime, userWallet.address, owner.address);

    console.log("XShare address:", xShare.address);

    /**************
     * XBond
     * *************/

    console.log("====================XBond====================");

    const XBond = await ethers.getContractFactory("XBond");
    const xBond = await XBond.deploy();

    console.log("XBond address:", xBond.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });