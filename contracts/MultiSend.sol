// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20; // [cite: 1]

/**
 * @title MultiSend
 * @notice Unified gas-optimised batch distribution contract for Arc Testnet. // [cite: 1]
 * Handles ERC-20 tokens, ERC-721, and ERC-1155 NFTs in one contract. // [cite: 2]
 *
 * Fee tiers (charged in USDC via msg.value on Arc where USDC is native gas):
 * 1–50  recipients → free (0 USDC)
 * 51–100 recipients → 0.05 USDC  (5e4 in 6-decimal units = 50_000)
 * 101–200 recipients → 0.10 USDC (1e5 in 6-decimal units = 100_000) // [cite: 3]
 *
 * On Arc Testnet, USDC is the native currency.
 * msg.value is denominated in the native unit (18-decimal wei equivalent), // [cite: 4]
 * but the fee constants below use the chain's actual smallest unit.
 * Arc's native USDC has 6 decimals and 1 USDC = 1e18 "wei" on-chain, // [cite: 5]
 * so 0.05 USDC = 5e16 wei and 0.10 USDC = 1e17 wei.
 *
 * Maximum batch size: 200 (enforced on-chain). // [cite: 6]
 */

// ── Minimal interfaces ──────────────────────────────────────────────────────

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool); // [cite: 7]
    function allowance(address owner, address spender) external view returns (uint256);
} // [cite: 8]

interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool); // [cite: 9]
}

interface IERC1155 {
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external; // [cite: 10]
} // [cite: 11]

// ── Contract ────────────────────────────────────────────────────────────────

contract MultiSend {

    // ── Immutables & state ──────────────────────────────────────────────────

    address public immutable owner; // [cite: 11]
    uint256 public constant MAX_RECIPIENTS = 200; // [cite: 12]

    /// Fee thresholds (recipient count, inclusive upper bound of free tier)
    uint256 public constant FREE_TIER_MAX   = 50;
    uint256 public constant MID_TIER_MAX    = 100; // [cite: 13]

    /// Fee amounts expressed in Arc-native wei (USDC has 6 decimals on Arc,
    /// but the chain uses 18-decimal wei internally, so multiply by 1e12).
    /// 0.05 USDC = 50_000 * 1e12 = 5e16 wei // [cite: 14]
    /// 0.10 USDC = 100_000 * 1e12 = 1e17 wei
    uint256 public constant FEE_MID  = 5e16;  // 0.05 USDC in wei // [cite: 15]
    uint256 public constant FEE_HIGH = 1e17;  // 0.10 USDC in wei // [cite: 16]

    // ── Custom errors (cheaper than require strings) ────────────────────────

    error NotOwner(); // [cite: 16]
    error TooManyRecipients(uint256 count, uint256 max); // [cite: 17]
    error ArrayLengthMismatch();
    error InsufficientFee(uint256 required, uint256 provided);
    error TransferFailed();
    error WithdrawFailed();
    error ZeroRecipients(); // [cite: 17]
    
    // ── Events ───────────────────────────────────────────────────────────────

    event TokensSent(address indexed token, address indexed sender, uint256 recipientCount); // [cite: 18]
    event Erc721Sent(address indexed token, address indexed sender, uint256 recipientCount); // [cite: 19]
    event Erc1155Sent(address indexed token, address indexed sender, uint256 recipientCount);
    event FeeReceived(address indexed sender, uint256 amount); // [cite: 20]
    event Withdrawn(address indexed to, uint256 amount);

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender; // [cite: 21]
    } // [cite: 22]

    // ── Fee helpers ──────────────────────────────────────────────────────────

    /// @dev Returns the required fee in wei for a given recipient count.
    function getFee(uint256 count) public pure returns (uint256) { // 
        if (count <= FREE_TIER_MAX) return 0;
        if (count <= MID_TIER_MAX)  return FEE_MID; // [cite: 24]
        return FEE_HIGH;
    }

    /// @dev Reverts if msg.value is less than the required fee.
    function _chargeFee(uint256 count) internal { // [cite: 25]
        uint256 required = getFee(count);
        if (required == 0) return; // [cite: 26]
        if (msg.value < required) revert InsufficientFee(required, msg.value);
        emit FeeReceived(msg.sender, msg.value);
    } // [cite: 27]

    // ════════════════════════════════════════════════════════════════════════
    //  ERC-20 TOKEN MULTISEND
    // ════════════════════════════════════════════════════════════════════════

    /**
     * @notice Batch-transfer an ERC-20 token to multiple recipients.
     * @param token      ERC-20 contract address (e.g. USDC, EURC) // [cite: 28]
     * @param recipients Array of recipient wallet addresses
     * @param amounts    Corresponding token amounts (in token base units)
     *
     * Caller must approve this contract for at least the sum of amounts
     * before calling.
     * Fee (if any) is paid as native USDC via msg.value. // [cite: 29]
     */
    function multisend(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable { // [cite: 30]
        uint256 count = recipients.length;
        if (count == 0)                revert ZeroRecipients(); // [cite: 31]
        if (count > MAX_RECIPIENTS)    revert TooManyRecipients(count, MAX_RECIPIENTS); // [cite: 32]
        if (count != amounts.length)   revert ArrayLengthMismatch();

        _chargeFee(count);
        IERC20 erc20 = IERC20(token); // [cite: 33]
        for (uint256 i = 0; i < count; ) {
            if (!erc20.transferFrom(msg.sender, recipients[i], amounts[i])) revert TransferFailed();
            unchecked { ++i; } // [cite: 34]
        }

        emit TokensSent(token, msg.sender, count);
    } // [cite: 35]

    // ════════════════════════════════════════════════════════════════════════
    //  ERC-721 NFT MULTISEND (PAYABLE)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * @notice Batch-transfer ERC-721 tokens to multiple recipients (Fee applicable).
     * @param token      ERC-721 contract address // [cite: 36]
     * @param recipients Array of recipient addresses
     * @param tokenIds   Corresponding token IDs (one per recipient)
     *
     * Caller must call setApprovalForAll(address(this), true) on the NFT
     * contract before calling.
     * Fee (if any) is paid via msg.value. // [cite: 37]
     */
    function multisendERC721(
        address token,
        address[] calldata recipients,
        uint256[] calldata tokenIds
    ) external payable {
        uint256 count = recipients.length; // [cite: 38]
        if (count == 0)                revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)    revert TooManyRecipients(count, MAX_RECIPIENTS); // [cite: 39]
        if (count != tokenIds.length)  revert ArrayLengthMismatch();

        _chargeFee(count);
        IERC721 nft = IERC721(token); // [cite: 40]
        for (uint256 i = 0; i < count; ) {
            nft.safeTransferFrom(msg.sender, recipients[i], tokenIds[i]);
            unchecked { ++i; } // [cite: 41]
        }

        emit Erc721Sent(token, msg.sender, count);
    } // [cite: 42]

    // ════════════════════════════════════════════════════════════════════════
    //  ERC-721 NFT MULTISEND (FREE - FROM NFTMULTISEND.SOL)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * @notice Send ERC-721 tokens to multiple recipients for Free (No collection tier logic). // [cite: 85]
     */
    function freeMultisendERC721(
        address token,
        address[] calldata recipients,
        uint256[] calldata tokenIds
    ) external {
        uint256 count = recipients.length; // [cite: 86]
        if (count == 0)                revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)    revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != tokenIds.length)  revert ArrayLengthMismatch();

        IERC721 nft = IERC721(token); // [cite: 87]
        for (uint256 i = 0; i < count; ) {
            nft.safeTransferFrom(msg.sender, recipients[i], tokenIds[i]);
            unchecked { ++i; } // [cite: 88]
        }

        emit Erc721Sent(token, msg.sender, count); // [cite: 89]
    }

    // ════════════════════════════════════════════════════════════════════════
    //  ERC-1155 NFT MULTISEND — one token per recipient (PAYABLE)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * @notice Batch-transfer ERC-1155 tokens to multiple recipients (Fee applicable).
     * @param token      ERC-1155 contract address // [cite: 43]
     * @param recipients Array of recipient addresses
     * @param ids        Token IDs (one per recipient)
     * @param amounts    Amounts (one per recipient)
     *
     * Fee (if any) is paid via msg.value.
     */
    function multisendERC1155(
        address token,
        address[] calldata recipients,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external payable { // [cite: 44]
        uint256 count = recipients.length;
        if (count == 0)                                   revert ZeroRecipients(); // [cite: 45]
        if (count > MAX_RECIPIENTS)                       revert TooManyRecipients(count, MAX_RECIPIENTS); // [cite: 46]
        if (count != ids.length || count != amounts.length) revert ArrayLengthMismatch(); // [cite: 47]

        _chargeFee(count);

        IERC1155 nft = IERC1155(token);
        for (uint256 i = 0; i < count; ) { // [cite: 48]
            nft.safeTransferFrom(msg.sender, recipients[i], ids[i], amounts[i], "");
            unchecked { ++i; } // [cite: 49]
        }

        emit Erc1155Sent(token, msg.sender, count);
    } // [cite: 50]

    // ════════════════════════════════════════════════════════════════════════
    //  ERC-1155 NFT MULTISEND — one token per recipient (FREE - FROM NFTMULTISEND.SOL)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * @notice Send ERC-1155 tokens to multiple recipients for Free (No collection tier logic). // [cite: 90]
     */
    function freeMultisendERC1155(
        address token,
        address[] calldata recipients,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        uint256 count = recipients.length; // [cite: 92]
        if (count == 0)                                   revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)                       revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != ids.length || count != amounts.length) revert ArrayLengthMismatch();

        IERC1155 nft = IERC1155(token); // [cite: 93]
        for (uint256 i = 0; i < count; ) {
            nft.safeTransferFrom(msg.sender, recipients[i], ids[i], amounts[i], "");
            unchecked { ++i; } // [cite: 94]
        }

        emit Erc1155Sent(token, msg.sender, count); // [cite: 95]
    }

    // ════════════════════════════════════════════════════════════════════════
    //  ERC-1155 NFT MULTISEND — multiple token IDs to one recipient (PAYABLE)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * @notice Batch-transfer multiple ERC-1155 token IDs to a single recipient (Fee applicable).
     * Uses safeBatchTransferFrom for maximum gas efficiency. // [cite: 51]
     * @param token     ERC-1155 contract address // [cite: 52]
     * @param recipient Single recipient address
     * @param ids       Array of token IDs
     * @param amounts   Corresponding amounts
     *
     * Fee is based on ids.length.
     * Fee (if any) is paid via msg.value. // [cite: 53]
     */
    function batchToOneERC1155(
        address token,
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external payable {
        uint256 count = ids.length; // [cite: 54]
        if (count == 0)              revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)  revert TooManyRecipients(count, MAX_RECIPIENTS); // [cite: 55]
        if (count != amounts.length) revert ArrayLengthMismatch();

        _chargeFee(count);

        IERC1155(token).safeBatchTransferFrom(msg.sender, recipient, ids, amounts, "");
        emit Erc1155Sent(token, msg.sender, 1); // [cite: 56]
    }

    // ════════════════════════════════════════════════════════════════════════
    //  ERC-1155 NFT MULTISEND — multiple token IDs to one recipient (FREE - FROM NFTMULTISEND.SOL)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * @notice Send multiple ERC-1155 token IDs to a single recipient for Free (No collection tier logic). // [cite: 96]
     */
    function freeBatchToOneERC1155(
        address token,
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        uint256 count = ids.length;
        if (count == 0)              revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)  revert TooManyRecipients(count, MAX_RECIPIENTS); // [cite: 97]
        if (count != amounts.length) revert ArrayLengthMismatch(); // [cite: 98]

        IERC1155(token).safeBatchTransferFrom(msg.sender, recipient, ids, amounts, "");
        emit Erc1155Sent(token, msg.sender, 1); // [cite: 99]
    }

    // ──═ OWNER — USDC COLLECTION & WITHDRAWAL ═══════════════════════════════

    /**
     * @notice Accept native USDC deposits (fee accumulation).
     * Also called implicitly when fees are paid via msg.value. // [cite: 57]
     */
    receive() external payable { // [cite: 58]
        if (msg.value > 0) emit FeeReceived(msg.sender, msg.value);
    } // [cite: 59]

    /**
     * @notice Withdraw all accumulated native USDC to the owner.
     * // [cite: 60]
     */
    function withdraw() external {
        if (msg.sender != owner) revert NotOwner();
        uint256 bal = address(this).balance; // [cite: 61]
        if (bal == 0) return;
        (bool ok, ) = payable(owner).call{value: bal}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(owner, bal); // [cite: 62]
    }

    /**
     * @notice Withdraw a specific amount of native USDC to the owner.
     * @param amount Amount in wei to withdraw. // [cite: 63]
     */
    function withdrawAmount(uint256 amount) external {
        if (msg.sender != owner) revert NotOwner(); // [cite: 64]
        if (amount == 0) return;
        (bool ok, ) = payable(owner).call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(owner, amount); // [cite: 65]
    }

    /**
     * @notice Recover any ERC-20 tokens accidentally sent to this contract.
     * @param token   ERC-20 token address // [cite: 66]
     * @param to      Destination address
     * @param amount  Amount to recover
     */
    function recoverERC20(address token, address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        if (!IERC20(token).transfer(to, amount)) revert TransferFailed(); // [cite: 67]
    }

    // ── View helpers ─────────────────────────────────────────────────────────

    /// @notice Returns the contract's current native USDC balance (wei).
    function contractBalance() external view returns (uint256) { // [cite: 68]
        return address(this).balance;
    } // [cite: 69]

    /// @notice Human-readable fee label for a given recipient count.
    function getFeeLabel(uint256 count) external pure returns (string memory) { // [cite: 70]
        if (count <= FREE_TIER_MAX) return "Free";
        if (count <= MID_TIER_MAX)  return "0.05 USDC"; // [cite: 71]
        return "0.10 USDC";
    }
}