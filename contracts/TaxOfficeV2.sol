// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./owner/Operator.sol";
import "./interfaces/ITaxable.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IERC20.sol";

contract TaxOfficeV2 is Operator {
    using SafeMath for uint256;

    address public mry;// = address(0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7);  // Get mry Address after deploied MRY.sol
    address public wftm;// = address(0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83);
    address public uniRouter;// = address(0xF491e7B69E4244ad4002BC14e878a34207E38c29);

    mapping(address => bool) public taxExclusionEnabled;

    constructor(address _mry, address _ftm, address _uniRouter)public{
        mry = address(_mry);
        wftm = address(_ftm);
        uniRouter = address(_uniRouter);
    }

    function setTaxTiersTwap(uint8 _index, uint256 _value) public onlyOperator returns (bool) {
        return ITaxable(mry).setTaxTiersTwap(_index, _value);
    }

    function setTaxTiersRate(uint8 _index, uint256 _value) public onlyOperator returns (bool) {
        return ITaxable(mry).setTaxTiersRate(_index, _value);
    }

    function enableAutoCalculateTax() public onlyOperator {
        ITaxable(mry).enableAutoCalculateTax();
    }

    function disableAutoCalculateTax() public onlyOperator {
        ITaxable(mry).disableAutoCalculateTax();
    }

    function setTaxRate(uint256 _taxRate) public onlyOperator {
        ITaxable(mry).setTaxRate(_taxRate);
    }

    function setBurnThreshold(uint256 _burnThreshold) public onlyOperator {
        ITaxable(mry).setBurnThreshold(_burnThreshold);
    }

    function setTaxCollectorAddress(address _taxCollectorAddress) public onlyOperator {
        ITaxable(mry).setTaxCollectorAddress(_taxCollectorAddress);
    }

    function excludeAddressFromTax(address _address) external onlyOperator returns (bool) {
        return _excludeAddressFromTax(_address);
    }

    function _excludeAddressFromTax(address _address) private returns (bool) {
        if (!ITaxable(mry).isAddressExcluded(_address)) {
            return ITaxable(mry).excludeAddress(_address);
        }
    }

    function includeAddressInTax(address _address) external onlyOperator returns (bool) {
        return _includeAddressInTax(_address);
    }

    function _includeAddressInTax(address _address) private returns (bool) {
        if (ITaxable(mry).isAddressExcluded(_address)) {
            return ITaxable(mry).includeAddress(_address);
        }
    }

    function taxRate() external view returns (uint256) {
        return ITaxable(mry).taxRate();
    }

    function addLiquidityTaxFree(
        address token,
        uint256 amtMry,
        uint256 amtToken,
        uint256 amtMryMin,
        uint256 amtTokenMin
    )
        external
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        require(amtMry != 0 && amtToken != 0, "amounts can't be 0");
        _excludeAddressFromTax(msg.sender);

        IERC20(mry).transferFrom(msg.sender, address(this), amtMry);
        IERC20(token).transferFrom(msg.sender, address(this), amtToken);
        _approveTokenIfNeeded(mry, uniRouter);
        _approveTokenIfNeeded(token, uniRouter);

        _includeAddressInTax(msg.sender);

        uint256 resultAmtMry;
        uint256 resultAmtToken;
        uint256 liquidity;
        (resultAmtMry, resultAmtToken, liquidity) = IUniswapV2Router(uniRouter).addLiquidity(
            mry,
            token,
            amtMry,
            amtToken,
            amtMryMin,
            amtTokenMin,
            msg.sender,
            block.timestamp
        );

        if(amtMry.sub(resultAmtMry) > 0) {
            IERC20(mry).transfer(msg.sender, amtMry.sub(resultAmtMry));
        }
        if(amtToken.sub(resultAmtToken) > 0) {
            IERC20(token).transfer(msg.sender, amtToken.sub(resultAmtToken));
        }
        return (resultAmtMry, resultAmtToken, liquidity);
    }

    function addLiquidityETHTaxFree(
        uint256 amtMry,
        uint256 amtMryMin,
        uint256 amtFtmMin
    )
        external
        payable
        returns (
            uint256,
            uint256,
            uint256
        )
    {

        require(amtMry != 0 && msg.value != 0, "amounts can't be 0");
        
        _excludeAddressFromTax(msg.sender);

        IERC20(mry).transferFrom(msg.sender, address(this), amtMry);
        _approveTokenIfNeeded(mry, uniRouter);

        _includeAddressInTax(msg.sender);

        uint256 resultAmtMry;
        uint256 resultAmtFtm;
        uint256 liquidity;
        (resultAmtMry, resultAmtFtm, liquidity) = IUniswapV2Router(uniRouter).addLiquidityETH{value: msg.value}(
            mry,
            amtMry,
            amtMryMin,
            amtFtmMin,
            msg.sender,
            block.timestamp
        );

        if(amtMry.sub(resultAmtMry) > 0) {
            IERC20(mry).transfer(msg.sender, amtMry.sub(resultAmtMry));
        }
        return (resultAmtMry, resultAmtFtm, liquidity);
    }

    function setTaxableMryOracle(address _mryOracle) external onlyOperator {
        ITaxable(mry).setMryOracle(_mryOracle);
    }

    function transferTaxOffice(address _newTaxOffice) external onlyOperator {
        ITaxable(mry).setTaxOffice(_newTaxOffice);
    }

    function taxFreeTransferFrom(
        address _sender,
        address _recipient,
        uint256 _amt
    ) external {
        require(taxExclusionEnabled[msg.sender], "Address not approved for tax free transfers");
        _excludeAddressFromTax(_sender);
        IERC20(mry).transferFrom(_sender, _recipient, _amt);
        _includeAddressInTax(_sender);
    }

    function setTaxExclusionForAddress(address _address, bool _excluded) external onlyOperator {
        taxExclusionEnabled[_address] = _excluded;
    }

    function _approveTokenIfNeeded(address _token, address _router) private {
        if (IERC20(_token).allowance(address(this), _router) == 0) {
            IERC20(_token).approve(_router, type(uint256).max);
        }
    }
}
