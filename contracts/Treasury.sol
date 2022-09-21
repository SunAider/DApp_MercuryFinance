// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./lib/Babylonian.sol";
import "./owner/Operator.sol";
import "./utils/ContractGuard.sol";
import "./interfaces/IBasisAsset.sol";
import "./interfaces/IOracle.sol";
import "./interfaces/IMasonry.sol";

import "hardhat/console.sol";

interface IBondTreasury {
    function totalVested() external view returns (uint256);
}

contract Treasury is ContractGuard {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    /* ========= CONSTANT VARIABLES ======== */

    uint256 public constant PERIOD = 6 hours;

    /* ========== STATE VARIABLES ========== */

    // governance
    address public operator;

    // flags
    bool public initialized = false;

    // epoch
    uint256 public startTime;
    uint256 public epoch = 0;
    uint256 public epochSupplyContractionLeft = 0;

    // exclusions from total supply
    address[] public excludedFromTotalSupply;

    // core components
    address public mry;
    address public xbond;
    address public xshare;

    address public masonry;
    address public mryOracle;

    // price
    uint256 public mryPriceOne;
    uint256 public mryPriceCeiling;

    uint256 public seigniorageSaved;

    uint256[] public supplyTiers;
    uint256[] public maxExpansionTiers;

    uint256 public maxSupplyExpansionPercent;
    uint256 public bondDepletionFloorPercent;
    uint256 public seigniorageExpansionFloorPercent;
    uint256 public maxSupplyContractionPercent;
    uint256 public maxDebtRatioPercent;

    // 28 first epochs (1 week) with 4.5% expansion regardless of MRY price
    uint256 public bootstrapEpochs;
    uint256 public bootstrapSupplyExpansionPercent;

    /* =================== Added variables =================== */
    uint256 public previousEpochMryPrice;
    uint256 public maxDiscountRate; // when purchasing bond
    uint256 public maxPremiumRate; // when redeeming bond
    uint256 public discountPercent;
    uint256 public premiumThreshold;
    uint256 public premiumPercent;
    uint256 public mintingFactorForPayingDebt; // print extra MRY during debt phase

    address public daoFund;
    uint256 public daoFundSharedPercent;

    address public devFund;
    uint256 public devFundSharedPercent;

    /* =================== Events =================== */

    event Initialized(address indexed executor, uint256 at);
    event BurnedBonds(address indexed from, uint256 bondAmount);
    event RedeemedBonds(address indexed from, uint256 mryAmount, uint256 bondAmount);
    event BoughtBonds(address indexed from, uint256 mryAmount, uint256 bondAmount);
    event TreasuryFunded(uint256 timestamp, uint256 seigniorage);
    event MasonryFunded(uint256 timestamp, uint256 seigniorage);
    event DaoFundFunded(uint256 timestamp, uint256 seigniorage);
    event DevFundFunded(uint256 timestamp, uint256 seigniorage);

    /* =================== Modifier =================== */
    modifier onlyOperator() {
        require(operator == msg.sender, "Treasury: caller is not the operator");
        _;
    }

    modifier checkCondition {
        require(block.timestamp >= startTime, "Treasury: not started yet");
        _;
    }

    modifier checkEpoch {
        require(block.timestamp >= nextEpochPoint(), "Treasury: not opened yet");
        _;
        epoch = epoch.add(1);
        epochSupplyContractionLeft = (getMryPrice() > mryPriceCeiling) ? 0 : getMryCirculatingSupply().mul(maxSupplyContractionPercent).div(10000);
    }

    modifier checkOperator {
        require(
            IBasisAsset(mry).operator() == address(this) &&
                IBasisAsset(xbond).operator() == address(this) &&
                IBasisAsset(xshare).operator() == address(this) &&
                Operator(masonry).operator() == address(this),
            "Treasury: need more permission"
        );
        _;
    }
    modifier notInitialized {
        require(!initialized, "Treasury: already initialized");

        _;
    }

    /* ========== VIEW FUNCTIONS ========== */

    function isInitialized() public view returns (bool) {
        return initialized;
    }

    // epoch
    function nextEpochPoint() public view returns (uint256) {
        return startTime.add(epoch.mul(PERIOD));
    }

    // oracle
    function getMryPrice() public view returns (uint256 mryPrice) {
        try IOracle(mryOracle).consult(mry, 1e18) returns (uint144 price) {
            return uint256(price);
        } catch {
            revert("Treasury: failed to consult MRY price from the oracle");
        }
    }

    function getMryUpdatedPrice() public view returns (uint256 _mryPrice) {
        try IOracle(mryOracle).twap(mry, 1e18) returns (uint144 price) {
            return uint256(price);
        } catch {
            revert("Treasury: failed to consult MRY price from the oracle");
        }
    }

    // budget
    function getReserve() public view returns (uint256) {
        return seigniorageSaved;
    }

    function getBurnableMryLeft() public view returns (uint256 _burnableMryLeft) {
        uint256 _mryPrice = getMryPrice();
        if (_mryPrice <= mryPriceOne) {
            uint256 _mrySupply = getMryCirculatingSupply();
            uint256 _bondMaxSupply = _mrySupply.mul(maxDebtRatioPercent).div(10000);
            uint256 _bondSupply = IERC20(xbond).totalSupply();
            if (_bondMaxSupply > _bondSupply) {
                uint256 _maxMintableBond = _bondMaxSupply.sub(_bondSupply);
                uint256 _maxBurnableMry = _maxMintableBond.mul(_mryPrice).div(1e18);
                _burnableMryLeft = Math.min(epochSupplyContractionLeft, _maxBurnableMry);
            }
        }
    }

    function getRedeemableBonds() public view returns (uint256 _redeemableBonds) {
        uint256 _mryPrice = getMryPrice();
        if (_mryPrice > mryPriceCeiling) {
            uint256 _totalMry = IERC20(mry).balanceOf(address(this));
            uint256 _rate = getBondPremiumRate();
            if (_rate > 0) {
                _redeemableBonds = _totalMry.mul(1e18).div(_rate);
            }
        }
    }

    function getBondDiscountRate() public view returns (uint256 _rate) {
        uint256 _mryPrice = getMryPrice();
        if (_mryPrice <= mryPriceOne) {
            if (discountPercent == 0) {
                // no discount
                _rate = mryPriceOne;
            } else {
                uint256 _bondAmount = mryPriceOne.mul(1e18).div(_mryPrice); // to burn 1 MRY
                uint256 _discountAmount = _bondAmount.sub(mryPriceOne).mul(discountPercent).div(10000);
                _rate = mryPriceOne.add(_discountAmount);
                if (maxDiscountRate > 0 && _rate > maxDiscountRate) {
                    _rate = maxDiscountRate;
                }
            }
        }
    }

    function getBondPremiumRate() public view returns (uint256 _rate) {
        uint256 _mryPrice = getMryPrice();
        if (_mryPrice > mryPriceCeiling) {
            uint256 _mryPricePremiumThreshold = mryPriceOne.mul(premiumThreshold).div(100);
            if (_mryPrice >= _mryPricePremiumThreshold) {
                //Price > 1.10
                uint256 _premiumAmount = _mryPrice.sub(mryPriceOne).mul(premiumPercent).div(10000);
                _rate = mryPriceOne.add(_premiumAmount);
                if (maxPremiumRate > 0 && _rate > maxPremiumRate) {
                    _rate = maxPremiumRate;
                }
            } else {
                // no premium bonus
                _rate = mryPriceOne;
            }
        }
    }

    /* ========== GOVERNANCE ========== */

    function initialize(
        address _mry,
        address _tbond,
        address _tshare,
        address _mryOracle,
        address _masonry,
        address _genesisPool,
        uint256 _startTime
    ) public notInitialized {
        mry = _mry;
        xbond = _tbond;
        xshare = _tshare;
        mryOracle = _mryOracle;
        masonry = _masonry;
        startTime = _startTime;

        mryPriceOne = 10**18;
        mryPriceCeiling = mryPriceOne.mul(101).div(100);

        // exclude contracts from total supply
        excludedFromTotalSupply.push(_genesisPool);

        // Dynamic max expansion percent
        supplyTiers = [0 ether, 500000 ether, 1000000 ether, 1500000 ether, 2000000 ether, 5000000 ether, 10000000 ether, 20000000 ether, 50000000 ether];
        maxExpansionTiers = [450, 400, 350, 300, 250, 200, 150, 125, 100];

        maxSupplyExpansionPercent = 400; // Upto 4.0% supply for expansion

        bondDepletionFloorPercent = 10000; // 100% of Bond supply for depletion floor
        seigniorageExpansionFloorPercent = 3500; // At least 35% of expansion reserved for masonry
        maxSupplyContractionPercent = 300; // Upto 3.0% supply for contraction (to burn MRY and mint XBOND)
        maxDebtRatioPercent = 3500; // Upto 35% supply of XBOND to purchase

        premiumThreshold = 110;
        premiumPercent = 7000;

        // First 28 epochs with 4.5% expansion
        bootstrapEpochs = 28;
        bootstrapSupplyExpansionPercent = 450;

        // set seigniorageSaved to it's balance
        seigniorageSaved = IERC20(mry).balanceOf(address(this));

        initialized = true;
        operator = msg.sender;
        emit Initialized(msg.sender, block.number);
    }

    function setOperator(address _operator) external onlyOperator {
        operator = _operator;
    }

    function setMasonry(address _masonry) external onlyOperator {
        masonry = _masonry;
    }

    function setMryOracle(address _mryOracle) external onlyOperator {
        mryOracle = _mryOracle;
    }

    function setMryPriceCeiling(uint256 _mryPriceCeiling) external onlyOperator {
        require(_mryPriceCeiling >= mryPriceOne && _mryPriceCeiling <= mryPriceOne.mul(120).div(100), "out of range"); // [$1.0, $1.2]
        mryPriceCeiling = _mryPriceCeiling;
    }

    function setMaxSupplyExpansionPercents(uint256 _maxSupplyExpansionPercent) external onlyOperator {
        require(_maxSupplyExpansionPercent >= 10 && _maxSupplyExpansionPercent <= 1000, "_maxSupplyExpansionPercent: out of range"); // [0.1%, 10%]
        maxSupplyExpansionPercent = _maxSupplyExpansionPercent;
    }

    function setSupplyTiersEntry(uint8 _index, uint256 _value) external onlyOperator returns (bool) {
        require(_index >= 0, "Index has to be higher than 0");
        require(_index < 9, "Index has to be lower than count of tiers");
        if (_index > 0) {
            require(_value > supplyTiers[_index - 1]);
        }
        if (_index < 8) {
            require(_value < supplyTiers[_index + 1]);
        }
        supplyTiers[_index] = _value;
        return true;
    }

    function setMaxExpansionTiersEntry(uint8 _index, uint256 _value) external onlyOperator returns (bool) {
        require(_index >= 0, "Index has to be higher than 0");
        require(_index < 9, "Index has to be lower than count of tiers");
        require(_value >= 10 && _value <= 1000, "_value: out of range"); // [0.1%, 10%]
        maxExpansionTiers[_index] = _value;
        return true;
    }

    function setBondDepletionFloorPercent(uint256 _bondDepletionFloorPercent) external onlyOperator {
        require(_bondDepletionFloorPercent >= 500 && _bondDepletionFloorPercent <= 10000, "out of range"); // [5%, 100%]
        bondDepletionFloorPercent = _bondDepletionFloorPercent;
    }

    function setMaxSupplyContractionPercent(uint256 _maxSupplyContractionPercent) external onlyOperator {
        require(_maxSupplyContractionPercent >= 100 && _maxSupplyContractionPercent <= 1500, "out of range"); // [0.1%, 15%]
        maxSupplyContractionPercent = _maxSupplyContractionPercent;
    }

    function setMaxDebtRatioPercent(uint256 _maxDebtRatioPercent) external onlyOperator {
        require(_maxDebtRatioPercent >= 1000 && _maxDebtRatioPercent <= 10000, "out of range"); // [10%, 100%]
        maxDebtRatioPercent = _maxDebtRatioPercent;
    }

    function setBootstrap(uint256 _bootstrapEpochs, uint256 _bootstrapSupplyExpansionPercent) external onlyOperator {
        require(_bootstrapEpochs <= 28, "_bootstrapEpochs: out of range"); // <= 1 week
        require(_bootstrapSupplyExpansionPercent >= 100 && _bootstrapSupplyExpansionPercent <= 1000, "_bootstrapSupplyExpansionPercent: out of range"); // [1%, 10%]
        bootstrapEpochs = _bootstrapEpochs;
        bootstrapSupplyExpansionPercent = _bootstrapSupplyExpansionPercent;
    }

    function setExtraFunds(
        address _daoFund,
        uint256 _daoFundSharedPercent,
        address _devFund,
        uint256 _devFundSharedPercent
    ) external onlyOperator {
        require(_daoFund != address(0), "zero");
        require(_daoFundSharedPercent <= 3000, "out of range"); // <= 30%
        require(_devFund != address(0), "zero");
        require(_devFundSharedPercent <= 1000, "out of range"); // <= 10%
        daoFund = _daoFund;
        daoFundSharedPercent = _daoFundSharedPercent;
        devFund = _devFund;
        devFundSharedPercent = _devFundSharedPercent;
    }

    function setMaxDiscountRate(uint256 _maxDiscountRate) external onlyOperator {
        maxDiscountRate = _maxDiscountRate;
    }

    function setMaxPremiumRate(uint256 _maxPremiumRate) external onlyOperator {
        maxPremiumRate = _maxPremiumRate;
    }

    function setDiscountPercent(uint256 _discountPercent) external onlyOperator {
        require(_discountPercent <= 20000, "_discountPercent is over 200%");
        discountPercent = _discountPercent;
    }

    function setPremiumThreshold(uint256 _premiumThreshold) external onlyOperator {
        require(_premiumThreshold >= mryPriceCeiling, "_premiumThreshold exceeds mryPriceCeiling");
        require(_premiumThreshold <= 150, "_premiumThreshold is higher than 1.5");
        premiumThreshold = _premiumThreshold;
    }

    function setPremiumPercent(uint256 _premiumPercent) external onlyOperator {
        require(_premiumPercent <= 20000, "_premiumPercent is over 200%");
        premiumPercent = _premiumPercent;
    }

    function setMintingFactorForPayingDebt(uint256 _mintingFactorForPayingDebt) external onlyOperator {
        require(_mintingFactorForPayingDebt >= 10000 && _mintingFactorForPayingDebt <= 20000, "_mintingFactorForPayingDebt: out of range"); // [100%, 200%]
        mintingFactorForPayingDebt = _mintingFactorForPayingDebt;
    }

    /* ========== MUTABLE FUNCTIONS ========== */

    function _updateMryPrice() internal {
        try IOracle(mryOracle).update() {} catch {}
    }

    function getMryCirculatingSupply() public view returns (uint256) {
        IERC20 mryErc20 = IERC20(mry);
        uint256 totalSupply = mryErc20.totalSupply();
        uint256 balanceExcluded = 0;
        for (uint8 entryId = 0; entryId < excludedFromTotalSupply.length; ++entryId) {
            balanceExcluded = balanceExcluded.add(mryErc20.balanceOf(excludedFromTotalSupply[entryId]));
        }
        return totalSupply.sub(balanceExcluded);
    }

    function buyBonds(uint256 _mryAmount, uint256 targetPrice) external onlyOneBlock checkCondition checkOperator {
        require(_mryAmount > 0, "Treasury: cannot purchase bonds with zero amount");

        uint256 mryPrice = getMryPrice();
        require(mryPrice == targetPrice, "Treasury: MRY price moved");
        require(
            mryPrice < mryPriceOne, // price < $1
            "Treasury: mryPrice not eligible for bond purchase"
        );

        require(_mryAmount <= epochSupplyContractionLeft, "Treasury: not enough bond left to purchase");

        uint256 _rate = getBondDiscountRate();
        require(_rate > 0, "Treasury: invalid bond rate");

        uint256 _bondAmount = _mryAmount.mul(_rate).div(1e18);
        uint256 mrySupply = getMryCirculatingSupply();
        uint256 newBondSupply = IERC20(xbond).totalSupply().add(_bondAmount);
        require(newBondSupply <= mrySupply.mul(maxDebtRatioPercent).div(10000), "over max debt ratio");

        IBasisAsset(mry).burnFrom(msg.sender, _mryAmount);
        IBasisAsset(xbond).mint(msg.sender, _bondAmount);

        epochSupplyContractionLeft = epochSupplyContractionLeft.sub(_mryAmount);
        _updateMryPrice();

        emit BoughtBonds(msg.sender, _mryAmount, _bondAmount);
    }

    function redeemBonds(uint256 _bondAmount, uint256 targetPrice) external onlyOneBlock checkCondition checkOperator {
        require(_bondAmount > 0, "Treasury: cannot redeem bonds with zero amount");

        uint256 mryPrice = getMryPrice();
        require(mryPrice == targetPrice, "Treasury: MRY price moved");
        require(
            mryPrice > mryPriceCeiling, // price > $1.01
            "Treasury: mryPrice not eligible for bond purchase"
        );

        uint256 _rate = getBondPremiumRate();
        require(_rate > 0, "Treasury: invalid bond rate");

        uint256 _mryAmount = _bondAmount.mul(_rate).div(1e18);
        require(IERC20(mry).balanceOf(address(this)) >= _mryAmount, "Treasury: treasury has no more budget");

        seigniorageSaved = seigniorageSaved.sub(Math.min(seigniorageSaved, _mryAmount));

        IBasisAsset(xbond).burnFrom(msg.sender, _bondAmount);
        IERC20(mry).safeTransfer(msg.sender, _mryAmount);

        _updateMryPrice();

        emit RedeemedBonds(msg.sender, _mryAmount, _bondAmount);
    }

    function _sendToMasonry(uint256 _amount) internal {
        IBasisAsset(mry).mint(address(this), _amount);

        uint256 _daoFundSharedAmount = 0;
        if (daoFundSharedPercent > 0) {
            _daoFundSharedAmount = _amount.mul(daoFundSharedPercent).div(10000);
            IERC20(mry).transfer(daoFund, _daoFundSharedAmount);
            emit DaoFundFunded(block.timestamp, _daoFundSharedAmount);
        }

        uint256 _devFundSharedAmount = 0;
        if (devFundSharedPercent > 0) {
            _devFundSharedAmount = _amount.mul(devFundSharedPercent).div(10000);
            IERC20(mry).transfer(devFund, _devFundSharedAmount);
            emit DevFundFunded(block.timestamp, _devFundSharedAmount);
        }

        _amount = _amount.sub(_daoFundSharedAmount).sub(_devFundSharedAmount);
        
        IERC20(mry).safeApprove(masonry, 0);
        IERC20(mry).safeApprove(masonry, _amount);
        IMasonry(masonry).allocateSeigniorage(_amount);
        emit MasonryFunded(block.timestamp, _amount);
    }

    function _calculateMaxSupplyExpansionPercent(uint256 _mrySupply) internal returns (uint256) {
        for (uint8 tierId = 8; tierId >= 0; --tierId) {
            if (_mrySupply >= supplyTiers[tierId]) {
                maxSupplyExpansionPercent = maxExpansionTiers[tierId];
                break;
            }
        }
        return maxSupplyExpansionPercent;
    }

    function allocateSeigniorage() external onlyOneBlock checkCondition checkEpoch checkOperator {
          _updateMryPrice();
          previousEpochMryPrice = getMryPrice();
         uint256 mrySupply = getMryCirculatingSupply().sub(seigniorageSaved);
         if (epoch < bootstrapEpochs) {
             // 28 first epochs with 4.5% expansion
             _sendToMasonry(mrySupply.mul(bootstrapSupplyExpansionPercent).div(10000));
        } else {
            if (previousEpochMryPrice > mryPriceCeiling) {
                // Expansion ($MRY Price > 1 $FTM): there is some seigniorage to be allocated
                uint256 bondSupply = IERC20(xbond).totalSupply();
                uint256 _percentage = previousEpochMryPrice.sub(mryPriceOne);
                uint256 _savedForBond;
                uint256 _savedForMasonry;
                uint256 _mse = _calculateMaxSupplyExpansionPercent(mrySupply).mul(1e14);
                if (_percentage > _mse) {
                    _percentage = _mse;
                }
                if (seigniorageSaved >= bondSupply.mul(bondDepletionFloorPercent).div(10000)) {
                    // saved enough to pay debt, mint as usual rate
                    _savedForMasonry = mrySupply.mul(_percentage).div(1e18);
                } else {
                    // have not saved enough to pay debt, mint more
                    uint256 _seigniorage = mrySupply.mul(_percentage).div(1e18);
                    _savedForMasonry = _seigniorage.mul(seigniorageExpansionFloorPercent).div(10000);
                    _savedForBond = _seigniorage.sub(_savedForMasonry);
                    if (mintingFactorForPayingDebt > 0) {
                        _savedForBond = _savedForBond.mul(mintingFactorForPayingDebt).div(10000);
                    }
                }
                if (_savedForMasonry > 0) {
                    _sendToMasonry(_savedForMasonry);
                }
                if (_savedForBond > 0) {
                    seigniorageSaved = seigniorageSaved.add(_savedForBond);
                    IBasisAsset(mry).mint(address(this), _savedForBond);
                    emit TreasuryFunded(block.timestamp, _savedForBond);
                }
            }
        }
    }

    function governanceRecoverUnsupported(
        IERC20 _token,
        uint256 _amount,
        address _to
    ) external onlyOperator {
        // do not allow to drain core tokens
        require(address(_token) != address(mry), "mry");
        require(address(_token) != address(xbond), "bond");
        require(address(_token) != address(xshare), "share");
        _token.safeTransfer(_to, _amount);
    }

    function masonrySetOperator(address _operator) external onlyOperator {
        IMasonry(masonry).setOperator(_operator);
    }

    function masonrySetLockUp(uint256 _withdrawLockupEpochs, uint256 _rewardLockupEpochs) external onlyOperator {
        IMasonry(masonry).setLockUp(_withdrawLockupEpochs, _rewardLockupEpochs);
    }

    function masonryAllocateSeigniorage(uint256 amount) external onlyOperator {
        IMasonry(masonry).allocateSeigniorage(amount);
    }

    function masonryGovernanceRecoverUnsupported(
        address _token,
        uint256 _amount,
        address _to
    ) external onlyOperator {
        IMasonry(masonry).governanceRecoverUnsupported(_token, _amount, _to);
    }
}
