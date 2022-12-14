const { expect } = require("chai");
const { ethers, getNamedAccounts, deployments } = require("hardhat");
const chalk = require('chalk');
const { getContractFactory } = require("@nomiclabs/hardhat-ethers/types");
const { Contract } = require("ethers");


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

async function main() {
    const { getContractFactory, getSigners } = ethers;

    /*
     * Get Accounts
     * owner, user1
     */
    [owner, user1] = await ethers.getSigners();

    console.log("\n");
    console.log("### 1. Starting Deploy token.js ###\n");
    console.log("- owner address is %s", owner.address);
    console.log("- user1 address is %s\n", user1.address);
    console.log("\n");

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
    //factory = "0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3";
    //wftm = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
    //router = "0xF491e7B69E4244ad4002BC14e878a34207E38c29";
    //usdc = "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75";

    routerIns = new ethers.Contract(router, uniswapRouterABI, owner);
    factoryIns = new ethers.Contract(factory, uniswapFactoryABI, owner);
    wftmIns = new ethers.Contract(wftm, wFtmABI, owner);

    startTimeGenesis = 1653994800;
    startTime = startTimeGenesis;// + 3 * 24 * 60 * 60;

    period = 6; // 6 hours

    console.log("BB: %d\n", ethers.utils.formatEther( await wftmIns.balanceOf(owner.address)));

    /*########################################
     * MRY Token
     */
    console.log("### Deploy MRY and set MRY\n");

    const taxCollector = owner.address;
    const taxRate = 0;
    //deploy
    console.log("- Deploy MRY\n");
    const MRY = await getContractFactory("MRY");
    mry = await MRY.deploy(taxRate, taxCollector);
    //await mry.mint(owner.address, ethers.utils.parseUnits("49", 18));

    console.log("  MRY address is %s", mry.address);
    console.log("  Balance of owner(%s) is %d MRY\n", owner.address, ethers.utils.formatEther(await mry.balanceOf(owner.address)));
//console.log("  MRY Operator is %s\n",await mry.operator());

    // Create liquidity pool FTM-MRY
    console.log("- Create liquidity pool with FTM-MRY\n");
    let tx = await mry.connect(owner).approve(routerIns.address, ethers.utils.parseUnits("1", 18));
    await tx.wait();
    console.log("  Approve transaction is %s", tx.hash);
    console.log("  Owner's balance is %d MRY before liquidity is created\n", ethers.utils.formatEther(await mry.balanceOf(owner.address)));

    tx = await routerIns.connect(owner).addLiquidityETH(
        mry.address,
        ethers.utils.parseUnits("1", 18),
        0,
        0,
        owner.address,
        "11111111111111111111111", { value: ethers.utils.parseUnits("1", 18) }
    );
    tx.wait();
    console.log("  Liquidity tx add to Owner FTM-MRY is %s", tx.hash);
    console.log("  Owner's balance is %d MRY after liquidity is created\n", ethers.utils.formatEther(await mry.balanceOf(owner.address)));
    //    console.log(tx);
    //Get pair address
    console.log("- Get pair address for FTM-MRY\n")
    const mry2ftmLP = await factoryIns.getPair(wftmIns.address, mry.address);
    console.log("  FTM-MRY LP Pair address is %s\n", mry2ftmLP);

    console.log("\n");

    /*########################################
     * Oracle (= SeigniorageOracle)
     */
    console.log("### Deploy Oracle\n");

    console.log("- Deploy");
    const Oracle = await getContractFactory("Oracle");
    oracle = await Oracle.deploy(mry2ftmLP, period, startTime);
    console.log("  Oracle address is %s\n", oracle.address);
//console.log("  Oracle Operator is %s\n",await oracle.operator());

    console.log("\n");

    /*########################################
     * TaxOracle
     */
    console.log("### Deploy TaxOracle\n");

    console.log("- Deploy");
    const TaxOracle = await getContractFactory("TaxOracle");
    taxOracle = await TaxOracle.deploy(mry.address, wftm, mry2ftmLP);
    console.log("  TaxOracle address is %s\n", taxOracle.address);
//console.log("  TaxOracle owner is %s\n",await taxOracle.owner());

    console.log("\n");

    /*########################################
     * TaxOfficeV2
     */
    console.log("### Deploy TaxOfficeV2\n");

    console.log("- Deploy");
    const TaxOffice = await getContractFactory("TaxOfficeV2");
    taxOffice = await TaxOffice.deploy(mry.address, wftm, router);
    console.log("  TaxOfficeV2 address is %s\n", taxOffice.address);
//console.log("  TaxOffice Operator is %s\n",await taxOffice.operator());

    await taxOffice.transferOwnership(owner.address);
    console.log("  set Ownership is %s", owner.address);

    await taxOffice.transferOperator(owner.address);
    console.log("  set Operator is %s", owner.address);
    // console.log("- Set TaxRate");
    // await taxOffice.setTaxRate(0);
    // console.log("- TaxRate is %d\n", 0);

    console.log("\n");

    /*########################################
     * XSHARE Token
     */
    console.log("### Deploy XSHARE and create liquidity\n");

    console.log("- Deploy XSHARE\n");
    const XShare = await getContractFactory("XShare");
    xshare = await XShare.deploy(startTime, owner.address);
    console.log("  XSHARE address is %s\n", xshare.address);
//console.log("  XShare Operator is %s\n",await xshare.operator());

    // Create liquidity pool FTM-XSHARE
    console.log("- Create liquidity pool with FTM-XSHARE\n");
    let tx2 = await xshare.connect(owner).approve(routerIns.address, ethers.utils.parseUnits("1", 18));
    await tx2.wait();
    console.log("  Approve transaction is %s.", tx2.hash);
    console.log("  Owner XSHARE balance is %d before liquidity is created\n", ethers.utils.formatEther(await xshare.balanceOf(owner.address)));

    tx2 = await routerIns.connect(owner).addLiquidityETH(
        xshare.address,
        ethers.utils.parseUnits("1", 18),
        0,
        0,
        owner.address,
        "11111111111111111111111", { value: ethers.utils.parseUnits("1", 18) }
    );
    tx2.wait();
    console.log("  Liquidity tx2 add to Owner XSHARE-FTM is %s", tx2.hash);
    console.log("  Owner's balance of XSHARE is %d after liquidity is created\n", ethers.utils.formatEther(await xshare.balanceOf(owner.address)));

    //Get pair address
    console.log("- Get pair address for FTM-XSHARE")
    const share2ftmLP = await factoryIns.getPair(wftmIns.address, xshare.address);
    console.log("  FTM-XSHARE LP Pair address is %s\n", share2ftmLP);

    console.log("\n");

    /*########################################
     * XShareRewardPool
     */
    console.log("### Deploy ShareRewardPool\n");

    console.log("- Deploy");
    const ShareRewardPool = await getContractFactory("XShareRewardPool");
    shareRewardPool = await ShareRewardPool.deploy(xshare.address, startTime);
    console.log("  shareRewardPool address is %s\n", shareRewardPool.address);
//console.log("  ShareRewardPool Operator is %s\n",await shareRewardPool.operator());

    console.log("- Add Pool for staking FTM-MRY to earn XSHARE: poolId = 0\n");
    await shareRewardPool.add(47500, mry2ftmLP, false, 0);
    console.log("  allocPoint is %d\n  token is %s\n  withUpdate is %d\n  lastRewardTime is %d(false)\n", 0, mry2ftmLP, 0, 0);
    //console.log(await shareRewardPool.poolInfo(0), "\n");

//console.log("  ShareRewardPool Operator is %s\n",await shareRewardPool.operator());
    console.log("- Add Pool for staking FTM-XSHARE to earn XSHARE: poolId = 1\n");
    await shareRewardPool.add(47500, share2ftmLP, false, 0);
    console.log("  allocPoint is %d\n  token is %s\n  withUpdate is %d\n  lastRewardTime is %d(false)\n", 0, share2ftmLP, 0, 0);
    //console.log(await shareRewardPool.poolInfo(1), "\n");

    console.log("\n");

    /*########################################
     * XSHARE Setting
     */
    console.log("### Set XSHARE\n");

    console.log("- Set distributeReward");
    await xshare.distributeReward(shareRewardPool.address);
    console.log("  rewardPoolDistributed is true.");
    console.log("  95000 XSHARE(FARMING_POOL_REWARD_ALLOCATION) is mint to ShareRewardPool\n");
//console.log("  xshare Operator is %s\n",await xshare.operator());

    console.log("\n");

    /*########################################
     * XBOND Token
     */
    console.log("### Deploy XBOND\n");

    console.log("- Deploy");
    const XBond = await getContractFactory("XBond");
    xbond = await XBond.deploy();
    console.log("  XBond address is %s\n", xbond.address);
//console.log("  XBond Operator is %s\n",await xbond.operator());

    console.log("\n");

    /*########################################
     * Treasury Deploy
     */
    console.log("### Deploy Treasury\n");

    console.log("- Deploy");
    const Treasury = await getContractFactory("Treasury");
    treasury = await Treasury.deploy();
    console.log("  Treasury address is %s\n", treasury.address);
//console.log("  Treasury Operator is %s\n",await treasury.operator());

    console.log("\n");

    /*########################################
     * Masonry
     */
    console.log("### Deploy Masonry\n");

    console.log("- Deploy");
    const Masonry = await getContractFactory("Masonry");
    masonry = await Masonry.deploy();
    console.log("  Masonry address is %s\n", masonry.address);
//console.log("  Masonry Operator is %s\n",await masonry.operator());

    //initialize
    console.log("- Initialize Masonry");
    await masonry.initialize(mry.address, xshare.address, treasury.address);
    console.log("  _mry is %s", mry.address);
    console.log("  _xshare is %s", xshare.address);
    console.log("  _treasury is %s", treasury.address);

    console.log("\n\n");

    /*########################################
     * MryGenesisRewardPool
     */
    console.log("### Deploy GenesisRewardPool\n");

    console.log("- Deploy");
    const MryGenesisRewardPool = await getContractFactory("MryGenesisRewardPool");
    mryGenesisRewardPool = await MryGenesisRewardPool.deploy(mry.address, startTimeGenesis);
    console.log("  MryGenesisRewardPool address is %s\n", mryGenesisRewardPool.address);

    //const rewardPerSecond = await mryGenesisRewardPool.mryPerSecond();
    //console.log("rewardPerSecond is %d\n", rewardPerSecond);

    console.log("- Add Pool for staking FTM to earn MRY: poolId = 0");
    await mryGenesisRewardPool.add(15000, wftm, false, 0, 100);
    console.log("  allocPoint is %d\n  token(FTM) is %s\n  withUpdate is %d\n  lastRewardTime is %d(now)\n  depositFeeBP is %d\n", 10000, wftm, 0, 0, 100);
    //console.log(await mryGenesisRewardPool.poolInfo(0), "\n");

    console.log("- Add Pool for staking USDC to earn MRY: poolId = 1");
    await mryGenesisRewardPool.add(10000, usdc, false, 0, 100);
    console.log("  allocPoint is %d\n  token(USDC) is %s\n  withUpdate is %d\n  lastRewardTime is %d(now)\n  depositFeeBP is %d\n", 15000, usdc, 0, 0, 100);
    //console.log(await mryGenesisRewardPool.poolInfo(1), "\n");

    console.log("- Set Fee Address");
    await mryGenesisRewardPool.setFeeAddress(owner.address);
    console.log("  Fee Address is owner.\n")
//console.log("  GenesisRewardPool Operator is %s\n",await mryGenesisRewardPool.operator());

    console.log("\n");

    /*########################################
     * MRY Setting
     */
    console.log("### Set MRY\n");

    console.log("- Set TaxOffice");
    await mry.setTaxOffice(taxOffice.address);
//console.log("  MRY Operator is %s\n",await mry.operator());
    console.log("  TaxOfficeV2 is %s as TaxOffice\n", taxOffice.address);

    console.log("- Set DisableAutoCalculateTax")
    await taxOffice.disableAutoCalculateTax();
//console.log("  Operator is %s\n",await taxOffice.operator());
    console.log("  DisableAutoCalculateTax is false\n");

    // console.log("- Set TaxRate")     
    // await mry.setTaxRate(0);             // if(10000 < TaxRate && autoCalculateTax = false), it can be run
    // console.log("  TaxRate is false\n");

    console.log("- Set if TaxCollectorAddress is not owner");
    const TaxCollectorAddress = owner.address;
    if (TaxCollectorAddress != owner.address) {
        await mry.setTaxCollectorAddress(owner.address);
        console.log("  TaxCollectorAddress(owner) is %s\n", owner.address);
    } else {
        console.log("  Not change TaxCollectorAddress\n");
    }

    console.log("- Set MryOracle");
    await mry.setMryOracle(taxOracle.address);
    console.log("  taxOracle is %s as MryOracle\n", taxOracle.address);

    console.log("- Set distributeReward");
    await mry.distributeReward(mryGenesisRewardPool.address);
    console.log("  rewardPoolDistributed is true.");
    console.log("  25000 MRY(INITIAL_GENESIS_POOL_DISTRIBUTION) is mint to genesisPool\n");

//console.log("  Operator is %s\n",await mry.operator());

    console.log("\n");

    /*########################################
     * Treasury Setting
     */
    console.log("### Set Treasury\n");

    console.log("- Initialized Treasury\n");
    await treasury.initialize(mry.address, 
        xbond.address, 
        xshare.address, 
        oracle.address, 
        masonry.address, 
        mryGenesisRewardPool.address, 
        startTime);
    console.log("  MRY is %s.", mry.address);
    console.log("  xbnod is %s.", xbond.address);
    console.log("  xshare is %s.", xshare.address);
    console.log("  mryOracle(oracle) is %s.", oracle.address);
    console.log("  masonry is %s.", masonry.address);
    console.log("  genesisPool is %s.", mryGenesisRewardPool.address);
    console.log("  startTime is %d.\n", startTime);

    console.log("- Set ExtraFunds");
    await treasury.setExtraFunds(user1.address, 1200, user1.address, 300); // now set daoFund=devFund
    console.log("  daoFund(user1) is %s, daoFundSharedPercent is %d.", user1.address, 1200);
    console.log("  devFund(user1) is %s, devFundSharedPercent is %d\n", user1.address, 300);

    console.log("- Set MaxDiscountRate");
    await treasury.setMaxDiscountRate(0);
    console.log("  MaxDiscountRate is 0\n");

    console.log("- Set MaxPremiumRate");
    await treasury.setMaxPremiumRate(0);
    console.log("  MaxPremiumRate is 0\n");

    console.log("- Set DiscountPercent");
    await treasury.setDiscountPercent(0);
    console.log("  DiscountPercent is 0\n");

    // console.log("- Set MintingFactorForPayingDebt");
    // await treasury.setMintingFactorForPayingDebt(0);     // 10000<_mintingFactorForPayingDebt<20000
    // console.log("  MintingFactorForPayingDebt is 0\n");

//console.log("  Operator is %s\n",await treasury.operator());

    console.log("\n");

    /*########################################
     * MryRewardPool
     */
    console.log("### Deploy MryRewardPool\n");

    console.log("- Deploy");

    const MryRewardPool = await getContractFactory("MryRewardPool");
    mryRewardPool = await MryRewardPool.deploy(mry.address, startTime);
    console.log("  MryRewardPool address is %s\n", mryRewardPool.address);
//console.log("  Operator is %s\n",await mryRewardPool.operator());

    console.log("\n");

    /*########################################
     * RebateTreasury
     */
    console.log("### Deploy RebateTreasury\n");

    console.log("- Deploy");

    const RebateTreasury = await getContractFactory("RebateTreasury");
    rebateTreasury = await RebateTreasury.deploy(mry.address, oracle.address, treasury.address)
    console.log("  RebateTreasury is %s\n", rebateTreasury.address);
//console.log("  RebateTreasury owner is %s\n",await rebateTreasury.owner());
    
    console.log("\n");

    /*########################################
     * Set operator Mry, XShare, XBond, Masonry
     */

    await mry.transferOperator(treasury.address);
    console.log("  mry's operator is ", await mry.operator());
    await xshare.transferOperator(treasury.address);
    console.log("  xshare's operator is ", await xshare.operator());
    await xbond.transferOperator(treasury.address);
    console.log("  xbond's operator is ", await xbond.operator());
    await masonry.setOperator(treasury.address);
    console.log("  masonry's operator is ", await masonry.operator());

    console.log("\n");

// await treasury.allocateSeigniorage();
//     console.log("OK");
    /*########################################
     * MRY mint to Masonry
     */


     // //MRY
     // await hre.run("verify:verify",{
     //     address:mry.address,
     //     constructorArguments:[0, owner.address],
     // });
     // //Oracle
     // await hre.run("verify:verify",{
     //     address:oracle.address,
     //     constructorArguments:[mry2ftmLP, period, startTime],
     // });
     // //TaxOracle
     // await hre.run("verify:verify",{
     //     address:taxOracle.address,
     //     constructorArguments:[mry.address, wftm, mry2ftmLP],
     // });
     // //TaxOfficeV2
     // await hre.run("verify:verify",{
     //     address:taxOffice.address,
     //     constructorArguments:[mry.address, wftm, router],
     // });
     // //xshare
     // await hre.run("verify:verify",{
     //     address:xshare.address,
     //     constructorArguments:[startTime, owner.address],
     // });
     // //xshareRewardPool
     // await hre.run("verify:verify",{
     //     address:shareRewardPool.address,
     //     constructorArguments:[xshare.address, startTime],
     // });
     // //xbond
     // await hre.run("verify:verify",{
     //     address:xbond.address,
     //     constructorArguments:[
     //     ],
     // });
     // //treasury
     // await hre.run("verify:verify",{
     //     address:treasury.address,
     //     constructorArguments:[
     //     ],
     // });
     // //masonry
     // await hre.run("verify:verify",{
     //     address:masonry.address,
     //     constructorArguments:[
     //     ],
     // });
     // //genesisPool
     // await hre.run("verify:verify",{
     //     address:mryGenesisRewardPool.address,
     //     constructorArguments:[mry.address, startTimeGenesis],
     // });
     // //MryRewardPool
     // await hre.run("verify:verify",{
     //     address:mryRewardPool.address,
     //     constructorArguments:[mry.address, startTime],
     // });
     // //RebateTreasury
     // await hre.run("verify:verify",{
     //     address:rebateTreasury.address,
     //     constructorArguments:[mry.address, oracle.address, treasury.address],
     // });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });