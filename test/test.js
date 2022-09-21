const { expect } = require("chai");
const { constants } = require("ethers");
const { ethers } = require("hardhat");
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace");

describe("Start Testing", function() {
    let mry, xShare, xBond;
    let owner
    let userWallet;
    it("Testing Tokens Contract", async function() {
        ///////////////////////////////////////////////////////
        //                  Deploy Token
        ///////////////////////////////////////////////////////
        [owner, userWallet] = await ethers.getSigners();

        /**************
         * MRY
    
        * *************/

        console.log("====================MRY====================");

        const taxCollector = owner.address;
        const taxRate = 0;

        const MRY = await ethers.getContractFactory("MRY");
        mry = await MRY.deploy(taxRate, taxCollector);

        console.log("MRY Token address:", mry.address);

        /**************
         * XSHARE
         * *************/

        console.log("====================XSHARE====================");

        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const startTime = blockBefore.timestamp + 1000000000;

        const XShare = await ethers.getContractFactory("XShare");
        xShare = await XShare.deploy(startTime, userWallet.address, owner.address);

        console.log("XShare address:", xShare.address);

        /**************
         * XBond
         * *************/

        console.log("====================XBond====================");

        const XBond = await ethers.getContractFactory("XBond");
        xBond = await XBond.deploy();

        console.log("XBond address:", xBond.address);

    });

    it("Testing TaxOffice To Create Liquidity", async function() {

        ///////////////////////////////////////////////////////
        //                  Configure DEX
        ///////////////////////////////////////////////////////

        /*
         * Get pair Address
         * Mecury and Fantom
         * TaxOfficeV2
         */
        console.log("====================TaxOfficeV2.sol====================");

        const TaxOfficeV2 = await ethers.getContractFactory("TaxOfficeV2");
        const taxOfficeV2 = await TaxOfficeV2.deploy();

        console.log("TaxOfficeV2 address:", taxOfficeV2.address);

    });

    it("Testing GenesisPool To Create Liquidity", async function() {

        ///////////////////////////////////////////////////////
        //                  GenesisPool
        ///////////////////////////////////////////////////////

        /*
         * Get pair Address
         * Mecury and Fantom
         * TaxOfficeV2
         */
        console.log("====================GenesisPool====================");

        const MryGenesisRewardPool = await ethers.getContractFactory("MryGenesisRewardPool");
        const mryGenesisRewardPool = await MryGenesisRewardPool.deploy(mry.address, 1649084166);

        console.log("MryGenesisRewardPool address:", mryGenesisRewardPool.address);

    });

    it("Testing MryRewardPool To Create Liquidity", async function() {

        ///////////////////////////////////////////////////////
        //                  MytRewardPool
        ///////////////////////////////////////////////////////

        /*
         * Get pair Address
         * Mecury and Fantom
         * TaxOfficeV2
         */
        console.log("====================MytRewardPool====================");

        const MryRewardPool = await ethers.getContractFactory("MryRewardPool");
        const mryRewardPool = await MryRewardPool.deploy(mry.address, 1647094157);

        console.log("mytRewardPool address:", mryRewardPool.address);
    });

    it("Testing XShareRewardPool To Create Liquidity", async function() {

        ///////////////////////////////////////////////////////
        //                  XShareRewardPool
        ///////////////////////////////////////////////////////

        /*
         * Get pair Address
         * Mecury and Fantom
         * TaxOfficeV2
         */
        console.log("====================MytRewardPool====================");

        const XShareRewardPool = await ethers.getContractFactory("XShareRewardPool");
        const xShareRewardPool = await XShareRewardPool.deploy(xShare.address, 1647094157);

        console.log("xShareRewardPool address:", xShareRewardPool.address);

    });
});