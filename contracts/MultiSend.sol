// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArcSender
 * @notice Unified batch distribution for Arc Testnet.
 * Natively scales standard token balances alongside traditional ERC-20, ERC-721 and ERC-1155 NFT properties.
 *
 * Fee tiers (paid in native USDC via msg.value):
 * 1–50   recipients → free (0)
 * 51–100 recipients → 0.05 USDC
 * 101–200 recipients → 0.10 USDC
 *
 * Arc Testnet native currency is USDC.
 * USDC has 6 decimals as an ERC-20 token.
 * BUT as native gas (msg.value), Arc uses 18-decimal wei internally.
 * So 1 USDC = 1_000_000 in ERC-20 units = 1_000_000_000_000_000_000 wei (1e18).
 * Therefore:
 * 0.05 USDC = 50_000 ERC-20 units = 50_000 * 1e12 = 5e16 wei
 * 0.10 USDC = 100_000 ERC-20 units = 100_000 * 1e12 = 1e17 wei
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

interface IERC1155 {
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external;
}

library SafeERC20 {
    error SafeTransferFromFailed();
    error SafeTransferFailed();

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        bool success = token.transferFrom(from, to, value);
        if (!success) revert SafeTransferFromFailed();
    }

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        bool success = token.transfer(to, value);
        if (!success) revert SafeTransferFailed();
    }
}

contract ArcSender {
    using SafeERC20 for IERC20;

    address public immutable owner;
    uint256 public constant MAX_RECIPIENTS = 200;

    // Protocol Constants
    uint256 public constant FREE_TIER_MAX = 50;
    uint256 public constant MID_TIER_MAX  = 100;
    uint256 public constant FEE_MID  = 5e16; // 0.05 USDC in 18-decimal wei
    uint256 public constant FEE_HIGH = 1e17; // 0.10 USDC in 18-decimal wei

    // FIX: Changed from a hardcoded 'constant' to a dynamic 'immutable' storage slot
    address public immutable nativeUsdcAddress;

    // Mutex guard tracking
    uint8 private _unlocked = 1;

    error NotOwner();
    error TooManyRecipients(uint256 count, uint256 max);
    error ArrayLengthMismatch();
    error InsufficientFee(uint256 required, uint256 provided);
    error TransferFailed();
    error WithdrawFailed();
    error ZeroRecipients();
    error ReentrancyGuard();

    event TokensSent(address indexed token, address indexed sender, uint256 recipientCount);
    event Erc721Sent(address indexed token, address indexed sender, uint256 recipientCount);
    event Erc1155Sent(address indexed token, address indexed sender, uint256 recipientCount);
    event FeeReceived(address indexed sender, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_unlocked == 0) revert ReentrancyGuard();
        _unlocked = 0;
        _;
        _unlocked = 1;
    }

    // FIX: Updated constructor to dynamically accept and assign the USDC reference configuration
    constructor(address _nativeUsdcAddress) {
        owner = msg.sender;
        nativeUsdcAddress = _nativeUsdcAddress;
    }

    /// @notice Helper function to evaluate required flat protocol fees based on recipient sizing thresholds
    function _chargeFee(uint256 count) internal {
        uint256 required = getFee(count);
        if (required == 0) return;
        if (msg.value < required) revert InsufficientFee(required, msg.value);
        emit FeeReceived(msg.sender, required);
    }

    // ════════════════════════════════════════════════════════
    //  ERC-20 MULTI-TOKEN MULTISEND
    // ════════════════════════════════════════════════════════

    function multisendMultiToken(
        address[] calldata tokens,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable nonReentrant {
        uint256 count = recipients.length;
        if (count == 0)             revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)  revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length || count != tokens.length) revert ArrayLengthMismatch();

        _chargeFee(count);

        uint256 trackingWeiValue = msg.value - getFee(count);

        for (uint256 i = 0; i < count; ) {
            address currentToken = tokens[i];
            uint256 currentAmount = amounts[i];
            address currentRecipient = recipients[i];

            // FIX: Uses your dynamic input parameter target assignment directly
            if (currentToken == nativeUsdcAddress) {
                // Scale 6-decimal user input into 18-decimal target allocation units
                uint256 costWei = currentAmount * 10 ** 12;
                if (trackingWeiValue < costWei) revert InsufficientFee(costWei, trackingWeiValue);
                
                trackingWeiValue -= costWei;
                
                (bool success, ) = payable(currentRecipient).call{value: costWei}("");
                if (!success) revert TransferFailed();
            } else {
                IERC20(currentToken).safeTransferFrom(msg.sender, currentRecipient, currentAmount);
            }

            unchecked { ++i; }
        }

        emit TokensSent(address(0), msg.sender, count);
    }

    // ════════════════════════════════════════════════════════
    //  ERC-721 NFT MULTISEND
    // ════════════════════════════════════════════════════════

    function multisendERC721(
        address token,
        address[] calldata recipients,
        uint256[] calldata tokenIds
    ) external payable nonReentrant {
        uint256 count = recipients.length;
        if (count == 0)               revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)   revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != tokenIds.length) revert ArrayLengthMismatch();

        _chargeFee(count);
        IERC721 nft = IERC721(token);

        for (uint256 i = 0; i < count; ) {
            nft.safeTransferFrom(msg.sender, recipients[i], tokenIds[i]);
            unchecked { ++i; }
        }
        emit Erc721Sent(token, msg.sender, count);
    }

    // ════════════════════════════════════════════════════════
    //  ERC-1155 SEMI-FUNGIBLE NFT MULTISEND
    // ════════════════════════════════════════════════════════

    function multisendERC1155(
        address token,
        address[] calldata recipients,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external payable nonReentrant {
        uint256 count = recipients.length;
        if (count == 0)                                     revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)                         revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != ids.length || count != amounts.length) revert ArrayLengthMismatch();

        _chargeFee(count);
        
        for (uint256 i = 0; i < count; ) {
            uint256[] memory uniqueId = new uint256[](1);
            uint256[] memory uniqueAmount = new uint256[](1);
            uniqueId[0] = ids[i];
            uniqueAmount[0] = amounts[i];
            
            IERC1155(token).safeBatchTransferFrom(msg.sender, recipients[i], uniqueId, uniqueAmount, "");
            unchecked { ++i; }
        }
        emit Erc1155Sent(token, msg.sender, count);
    }

    // ════════════════════════════════════════════════════════
    //  ADDITIONAL frontend COMPATIBILITY WRAPPERS
    // ════════════════════════════════════════════════════════

    function batchToOneERC1155(
        address token,
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external payable nonReentrant {
        uint256 count = ids.length;
        if (count == 0)              revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)  revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length) revert ArrayLengthMismatch();

        _chargeFee(count);
        IERC1155(token).safeBatchTransferFrom(msg.sender, recipient, ids, amounts, "");
        emit Erc1155Sent(token, msg.sender, 1);
    }

    function getFee(uint256 count) public pure returns (uint256) {
        if (count <= 50) return 0;
        if (count <= 100) return 5 * 10 ** 16; 
        return 1 * 10 ** 17; 
    }

    // ── Owner Utilities ─────────────────────────────────────────

    receive() external payable {
        if (msg.value > 0) emit FeeReceived(msg.sender, msg.value);
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        if (bal == 0) return;
        (bool ok,) = payable(owner).call{value: bal}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(owner, bal);
    }

    function withdrawAmount(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) return;
        (bool ok,) = payable(owner).call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(owner, amount);
    }

    function recoverERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (!IERC20(token).transfer(to, amount)) revert TransferFailed();
    }

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getFeeLabel(uint256 count) external pure returns (string memory) {
        if (count <= FREE_TIER_MAX) return "Free";
        if (count <= MID_TIER_MAX)  return "0.05 USDC";
        return "0.10 USDC";
    }
}