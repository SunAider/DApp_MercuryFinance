const { ethers } = require("hardhat");

async function main() {

    /*
     * TaxOfficeV2
     */

    console.log("====================TaxOfficeV2.sol====================");

    const TaxOfficeV2 = await ethers.getContractFactory("TaxOfficeV2");
    const taxOfficeV2 = await TaxOfficeV2.deploy();

    console.log("TaxOfficeV2 address:", taxOfficeV2.address);

    const amtMry = ethers.utils.parseUnits("0.1", 18);
    const amtMryMin = 0;
    const amtFtmMin = 0;

    // const balance = await mry.balanceOf(owner.address);
    // console.log("balance of owner before minting", ethers.utils.formatEther(balance));

    // await mry.mint(owner.address, amtMry);

    // const mint = await mry.balanceOf(owner.address);
    // console.log("balance of owner after minting", mint);
    //console.log(owner.address);

    let tx = await taxOfficeV2.addLiquidityETHTaxFree(amtMry, amtMryMin, amtFtmMin, { value: ethers.utils.parseEther("0.1") });
    await tx.wait();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });