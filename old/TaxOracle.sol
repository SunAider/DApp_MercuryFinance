// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/*
  ______                __       _______
 /_  __/___  ____ ___  / /_     / ____(_)___  ____ _____  ________
  / / / __ \/ __ `__ \/ __ \   / /_  / / __ \/ __ `/ __ \/ ___/ _ \
 / / / /_/ / / / / / / /_/ /  / __/ / / / / / /_/ / / / / /__/  __/
/_/  \____/_/ /_/ /_/_.___/  /_/   /_/_/ /_/\__,_/_/ /_/\___/\___/

    http://mry.finance
*/
contract MryTaxOracle is Ownable {
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

    function setMry(address _mry) external onlyOwner {
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
