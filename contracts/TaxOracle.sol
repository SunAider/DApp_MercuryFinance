// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TaxOracle is Ownable {
    using SafeMath for uint256;

    IERC20 public mry;
    IERC20 public wftm;
    address public pair;

    constructor(
        address _mry,
        address _wftm,
        address _pair
    ) public {
        require(_mry != address(0), "mry address cannot be 0");
        require(_wftm != address(0), "wftm address cannot be 0");
        require(_pair != address(0), "pair address cannot be 0");
        mry = IERC20(_mry);
        wftm = IERC20(_wftm);
        pair = _pair;
    }

    function consult(address _token, uint256 _amountIn) external view returns (uint144 amountOut) {
        require(_token == address(mry), "token needs to be mry");
        uint256 mryBalance = mry.balanceOf(pair);
        uint256 wftmBalance = wftm.balanceOf(pair);
        return uint144(mryBalance.div(wftmBalance));
    }

    function getMryBalance() external view returns (uint256) {
	return mry.balanceOf(pair);
    }

    function getWftmBalance() external view returns (uint256) {
	return wftm.balanceOf(pair);
    }

    function getPrice() external view returns (uint256) {
        uint256 mryBalance = mry.balanceOf(pair);
        uint256 wftmBalance = wftm.balanceOf(pair);
        return wftmBalance.mul(1e18).div(mryBalance);
    }

    function setTomb(address _mry) external onlyOwner {
        require(_mry != address(0), "mry address cannot be 0");
        mry = IERC20(_mry);
    }

    function setWftm(address _wftm) external onlyOwner {
        require(_wftm != address(0), "wftm address cannot be 0");
        wftm = IERC20(_wftm);
    }

    function setPair(address _pair) external onlyOwner {
        require(_pair != address(0), "pair address cannot be 0");
        pair = _pair;
    }
}
