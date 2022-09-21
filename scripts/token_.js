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
    factory = "0xee4bc42157cf65291ba2fe839ae127e3cc76f741";
    wftm = "0xf1277d1ed8ad466beddf92ef448a132661956621";
    router = "0xa6ad18c2ac47803e193f75c3677b14bf19b94883";
    usdc = "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75";
    //Mainnet Router, Factory, WFTM, USDC
    // factory = "0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3";
    // wftm = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
    // router = "0xF491e7B69E4244ad4002BC14e878a34207E38c29";
    // usdc = "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75";

    routerIns = new ethers.Contract(router, uniswapRouterABI, owner);
    factoryIns = new ethers.Contract(factory, uniswapFactoryABI, owner);
    wftmIns = new ethers.Contract(wftm, wFtmABI, owner);

    startTimeGenesis = 1653969600;
    startTime = startTimeGenesis;// + 3* 24 * 60 * 60;

    period = 6; // 6 hours

console.log("BB: ");
    /*########################################
     * MRY
     */
    mry = new ethers.Contract("0xfa28927Ba5a3CBAe71070bCA7cAc3F150504E263", mryABI, owner); // After run token.js, Copy mry address
    const mry2ftmLP = "0x47362A8a29273a5292dEdEbEE5C76C14eC7348a7";

    /*########################################
     * Oracle
     */
    oracle = new ethers.Contract("0x8552EB7Ea2Ab6F4876038e2bEac0ab9Db6aD89cB", oracleABI, owner); // After run token.js, Copy oracle address
    // const epoch = new ethers.Contract("0x07382ca7c0E1f4552A0967e5DACe30bB12C4E2dD", epochABI, owner); // After run token.js, Copy oracle address

    /*########################################
     * TaxOracle
     */
    taxOracle = new ethers.Contract("0x01319E11702501B52e8332bEe9e5f070660226Ef", taxOracleABI, owner); // After run token.js, Copy taxOracle address

    /*########################################
     * TaxOfficeV2
     */
    taxOffice = new ethers.Contract("0x4148a5EDE2dB01AEc70f9c5c2D53EcDfdFeFF2Ce", taxOfficeABI, owner); // After run token.js, Copy taxOffice address

    /*########################################
     * XSHARE
     */
    xshare = new ethers.Contract("0x6Cf402a1004BD9753Cd8B94436876BbD52fB6721", xshareABI, owner); // After run token.js, Copy xshare address
    // const share2ftmLP = "0xe2087f12596972F4c597c5B07085FA7FA28F4E60";

    /*########################################
     * shareRewardPool
     */
    shareRewardPool = new ethers.Contract("0xE06307d94Ef805391783680572c9bE3FE87f0C8A", shareRewardABI, owner); // After run token.js, Copy shareRewardPool address

    /*########################################
     * XBOND
     */
    xbond = new ethers.Contract("0x9e6F672BC4683622Cf831B233FAFe5b812b31e6C", xbondABI, owner); // After run token.js, Copy xbond address

    /*########################################
     * Treasury
     */
    treasury = new ethers.Contract("0x4d61eB575bf80017A0B73b9141aca31416C8def4", treasuryABI, owner); // After run token.js, Copy treasury address

    /*########################################
     * Masonry
     */
    masonry = new ethers.Contract("0x649b0FC1258AF632989692e2ECF3d6Ae4b262653", masonryABI, owner); // After run token.js, Copy masonry address

    /*########################################
     * mryGenesisRewardPool
     */
    mryGenesisRewardPool = new ethers.Contract("0xCf92a033C6b761f96a5EEbb270d90AB233f86990", genesisABI, owner); // After run token.js, Copy mryGenesisRewardPool address

    
    /*########################################
     *
     * Continue after failed token.js
     */

    // console.log(" flg = ", await treasury.flg());
    console.log("epoch before allocateSeigniorage ", await treasury.epoch());
    await treasury.allocateSeigniorage();
    console.log("allocate OK");
    // console.log(" flg = ", await treasury.flg());
    console.log("epoch after allocateSeigniorage ", await treasury.epoch());

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });