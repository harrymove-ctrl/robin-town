// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/**
 * @title RobinTownHarborVault
 * @notice On-chain World is Flat ($wif) Staking Vault, District Patronage, and Ranked Harbor Arena
 *         for Robin Town on Robinhood Chain Mainnet (Chain ID 4663).
 * @dev Official World is Flat ($wif) token: 0x5173b8eA6923c2d40267890D45C46a3480954773.
 *      Traders can stake $wif with instant withdrawal to unlock the 1.20x annual storefront payday
 *      multiplier, or patronize harbor districts and enter ranked matches where 50% of $wif is
 *      permanently burned to 0x000000000000000000000000000000000000dEaD and 50% funds the vault pool.
 */
contract RobinTownHarborVault {
    address public constant OFFICIAL_WIF_MAINNET = 0x5173b8eA6923c2d40267890D45C46a3480954773;
    address public constant BURN_SINK = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant MIN_BOOST_STAKE = 10 ether;
    uint8 public constant DISTRICT_COUNT = 6;

    IERC20 public immutable wif;
    address public owner;

    uint256 private unlocked = 1;

    uint256 public totalStaked;
    uint256 public totalBurnedViaVault;
    uint256 public totalHarborPool;

    mapping(address => uint256) public stakedBalanceOf;
    mapping(address => uint256) public lifetimeBurnedBy;
    mapping(uint8 => uint256) public districtPatronageTotal;
    mapping(bytes32 => mapping(address => uint256)) public matchEntries;

    event HarborStaked(address indexed trader, uint256 amount, uint256 newStakedBalance);
    event HarborUnstaked(address indexed trader, uint256 amount, uint256 remainingStakedBalance);
    event HarborBurn(address indexed trader, uint256 burnedAmount, bytes32 indexed category);
    event DistrictPatronized(
        address indexed trader,
        uint8 indexed districtId,
        uint256 totalAmount,
        uint256 burnedAmount,
        uint256 vaultAdded
    );
    event RankedHarborEntered(
        address indexed trader,
        bytes32 indexed matchId,
        uint256 totalAmount,
        uint256 burnedAmount,
        uint256 poolAdded
    );
    event HarborRewardDistributed(address indexed recipient, uint256 amount, bytes32 indexed reason);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ReentrancyBlocked();
    error InvalidAmount();
    error InvalidDistrict();
    error InsufficientStake();
    error InsufficientPoolBalance();
    error Unauthorized();
    error TransferFailed();

    modifier nonReentrant() {
        if (unlocked != 1) revert ReentrancyBlocked();
        unlocked = 2;
        _;
        unlocked = 1;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address wifTokenAddress) {
        address resolved = wifTokenAddress == address(0) ? OFFICIAL_WIF_MAINNET : wifTokenAddress;
        wif = IERC20(resolved);
        owner = msg.sender;
    }

    /**
     * @notice Returns true if trader qualifies for the 1.20x annual storefront payday multiplier.
     */
    function hasPaydayBoost(address trader) external view returns (bool) {
        return stakedBalanceOf[trader] >= MIN_BOOST_STAKE || lifetimeBurnedBy[trader] >= 1 ether;
    }

    /**
     * @notice Stakes $wif in the Harbor Vault to activate the 1.20x storefront payday boost.
     *         Funds remain 100% withdrawable at any time via unstakeWif.
     */
    function stakeWif(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        _pullWif(msg.sender, address(this), amount);
        stakedBalanceOf[msg.sender] += amount;
        totalStaked += amount;
        emit HarborStaked(msg.sender, amount, stakedBalanceOf[msg.sender]);
    }

    /**
     * @notice Withdraws previously staked $wif back to the trader wallet immediately.
     */
    function unstakeWif(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 current = stakedBalanceOf[msg.sender];
        if (current < amount) revert InsufficientStake();
        unchecked {
            stakedBalanceOf[msg.sender] = current - amount;
            totalStaked -= amount;
        }
        _pushWif(msg.sender, amount);
        emit HarborUnstaked(msg.sender, amount, stakedBalanceOf[msg.sender]);
    }

    /**
     * @notice Patronizes one of the 6 Robin Town harbor districts (0..5) using $wif.
     *         Splits 50% permanently burned to 0x...dEaD and 50% added to the Harbor Pool.
     */
    function patronizeDistrict(uint8 districtId, uint256 amount) external nonReentrant {
        if (districtId >= DISTRICT_COUNT) revert InvalidDistrict();
        if (amount < 2) revert InvalidAmount();

        uint256 burnShare = amount / 2;
        uint256 poolShare = amount - burnShare;

        _pullWif(msg.sender, BURN_SINK, burnShare);
        _pullWif(msg.sender, address(this), poolShare);

        totalBurnedViaVault += burnShare;
        totalHarborPool += poolShare;
        lifetimeBurnedBy[msg.sender] += burnShare;
        districtPatronageTotal[districtId] += amount;

        emit HarborBurn(msg.sender, burnShare, bytes32("DISTRICT_PATRON"));
        emit DistrictPatronized(msg.sender, districtId, amount, burnShare, poolShare);
    }

    /**
     * @notice Enters a Ranked Harbor Arena match (or Daily Seeded Challenge pot) using $wif.
     *         Splits 50% permanently burned to 0x...dEaD and 50% added to the Harbor Pool.
     */
    function enterRankedHarbor(bytes32 matchId, uint256 amount) external nonReentrant {
        if (amount < 2) revert InvalidAmount();

        uint256 burnShare = amount / 2;
        uint256 poolShare = amount - burnShare;

        _pullWif(msg.sender, BURN_SINK, burnShare);
        _pullWif(msg.sender, address(this), poolShare);

        totalBurnedViaVault += burnShare;
        totalHarborPool += poolShare;
        lifetimeBurnedBy[msg.sender] += burnShare;
        matchEntries[matchId][msg.sender] += amount;

        emit HarborBurn(msg.sender, burnShare, matchId);
        emit RankedHarborEntered(msg.sender, matchId, amount, burnShare, poolShare);
    }

    /**
     * @notice Distributes $wif prizes strictly from totalHarborPool (never touching user staked funds).
     */
    function distributeHarborReward(
        address recipient,
        uint256 amount,
        bytes32 reason
    ) external onlyOwner nonReentrant {
        if (recipient == address(0) || amount == 0) revert InvalidAmount();
        if (amount > totalHarborPool) revert InsufficientPoolBalance();
        unchecked {
            totalHarborPool -= amount;
        }
        _pushWif(recipient, amount);
        emit HarborRewardDistributed(recipient, amount, reason);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAmount();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _pullWif(address from, address to, uint256 amount) private {
        if (!wif.transferFrom(from, to, amount)) revert TransferFailed();
    }

    function _pushWif(address to, uint256 amount) private {
        if (!wif.transfer(to, amount)) revert TransferFailed();
    }
}
