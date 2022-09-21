const { expect } = require("chai");
const { ethers, getNamedAccounts, deployments } = require("hardhat");
const chalk = require('chalk');
const { getContractFactory } = require("@nomiclabs/hardhat-ethers/types");


let mry, xshare, xbond;
let owner, userWallet;
let factory, wftm, router, usdc;
let treasury, masonry, rebateTreasury, oracle;
let mryGenesisRewardPool, mryRewardPool, shareRewardPool;
let taxOffice, taxOracle;
let startTime;

let routerIns, factoryIns, wftmIns;
let mryIns, xshareIns, xbondIns, oracleIns;

const uniswapRouterABI = require("../artifacts/contracts/lib/UniswapV2Router02.sol/UniswapV2Router02.json").abi;
const uniswapFactoryABI = require("../artifacts/contracts/lib/UniswapV2Factory.sol/UniswapV2Factory.json").abi;
const wFtmABI = require("../artifacts/contracts/lib/WFTM.sol/WrappedFtm.json").abi;
const oracleABI = require("../artifacts/contracts/Oracle.sol/Oracle.json").abi;

const mryABI = require("../artifacts/contracts/MRY.sol/MRY.json").abi;
const xshareABI = require("../artifacts/contracts/XShare.sol/XShare.json").abi;
const xbondABI = require("../artifacts/contracts/XBond.sol/XBond.json").abi;
const genesisABI = require("../artifacts/contracts/distribution/MryGenesisRewardPool.sol/MryGenesisRewardPool.json").abi;
const shareRewardABI = require("../artifacts/contracts/distribution/XShareRewardPool.sol/XShareRewardPool.json").abi;
const masonryABI = require("../artifacts/contracts/Masonry.sol/Masonry.json").abi;
const treasuryABI = require("../artifacts/contracts/Treasury.sol/Treasury.json").abi;
const taxOracleABI = require("../artifacts/contracts/TaxOracle.sol/TaxOracle.json").abi;
const taxOfficeABI = require("../artifacts/contracts/TaxOffice.sol/TaxOffice.json").abi;
const epochABI = require("../artifacts/contracts/utils/Epoch.sol/Epoch.json").abi;

async function main() {
    const { getContractFactory, getSigners } = ethers;

    /*
     * Get Accounts
     * owner, user1
     */
    [owner, user1] = await ethers.getSigners();

    console.log("\n\n");
    console.log("### 2. Starting Deploy token_.js ###\n");
    console.log("- owner address is %s", owner.address);
    console.log("- user1 address is %s", user1.address);
    console.log("\n\n");

    /*
     * SET AND GET UNISWAP LIBRARY for testnet
     * factory, wftm, router
     */
    //Testnet Router, Factory, WFTM, USDC
    // factory = "0xee4bc42157cf65291ba2fe839ae127e3cc76f741";
    // wftm = "0xf1277d1ed8ad466beddf92ef448a132661956621";
    // router = "0xa6ad18c2ac47803e193f75c3677b14bf19b94883";
    // usdc = "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75";
    //Mainnet Router, Factory, WFTM, USDC
    factory = "0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3";
    wftm = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
    router = "0xF491e7B69E4244ad4002BC14e878a34207E38c29";
    usdc = "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75";

    routerIns = new ethers.Contract(router, uniswapRouterABI, owner);
    factoryIns = new ethers.Contract(factory, uniswapFactoryABI, owner);
    wftmIns = new ethers.Contract(wftm, wFtmABI, owner);

    startTimeGenesis = 1652464800;
    startTime = startTimeGenesis;//

    period = 6; // 6 hours

console.log("BB: ");
    /*########################################
     * MRY
     */
    mry = new ethers.Contract("0x95CAa2b2C08C29C31F985F80Cb840b7624cCbE37", mryABI, owner); // After run token.js, Copy mry address
    const mry2ftmLP = "0x8a103EA9f20d0A76aB06dbAdfCfaC36fC98DED21";

    /*########################################
     * Oracle
     */
    oracle = new ethers.Contract("0x017F0912F9B40282EF5580F91E773727d241896F", oracleABI, owner); // After run token.js, Copy oracle address
    // const epoch = new ethers.Contract("0x07382ca7c0E1f4552A0967e5DACe30bB12C4E2dD", epochABI, owner); // After run token.js, Copy oracle address

    /*########################################
     * TaxOracle
     */
    taxOracle = new ethers.Contract("0x821D46199857e108c028697214e0B5465b4E9CD0", taxOracleABI, owner); // After run token.js, Copy taxOracle address

    /*########################################
     * TaxOfficeV2
     */
    taxOffice = new ethers.Contract("0x0bA3E4a92c6e163cA34193D2C5bDe4DabE2e921f", taxOfficeABI, owner); // After run token.js, Copy taxOffice address

    /*########################################
     * XSHARE
     */
    xshare = new ethers.Contract("0xc44D73f429AD913A9c1f8436A19686EC757df47b", xshareABI, owner); // After run token.js, Copy xshare address
    // const share2ftmLP = "0x0000000000000000000000000000000000000000";

    /*########################################
     * shareRewardPool
     */
    shareRewardPool = new ethers.Contract("0x24aa1C6A7C21F65ED3aA158A73545ae019CacB23", shareRewardABI, owner); // After run token.js, Copy shareRewardPool address

    /*########################################
     * XBOND
     */
    xbond = new ethers.Contract("0x2a7A24D25D68d1910cF74f7146bC6850F0B2D884", xbondABI, owner); // After run token.js, Copy xbond address

    /*########################################
     * Treasury
     */
    treasury = new ethers.Contract("0x86f815976fee34Fc05ED02Db7F01B8C8FF9Ed629", treasuryABI, owner); // After run token.js, Copy treasury address

    /*########################################
     * Masonry
     */
    masonry = new ethers.Contract("0xf5754f7a9F7Eab991250eCAb6cE982730bC27357", masonryABI, owner); // After run token.js, Copy masonry address

    /*########################################
     * mryGenesisRewardPool
     */
    mryGenesisRewardPool = new ethers.Contract("0x4b2C5b09666Bf51eEBFa36832BcB8DF4F661d2DA", genesisABI, owner); // After run token.js, Copy mryGenesisRewardPool address

    
    /*########################################
     *
     * Continue after failed token.js
     */

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });