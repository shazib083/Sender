// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArcSender
 * @notice Unified batch distribution for Arc Testnet.
 * Handles ERC-20 tokens, ERC-721 and ERC-1155 NFTs.
 *
 * Fee tiers (paid in native USDC via msg.value):
 *   1–50   recipients → free (0)
 *   51–100 recipients → 0.05 USDC
 *   101–200 recipients → 0.10 USDC
 *
 * Arc Testnet native currency is USDC.
 * USDC has 6 decimals as an ERC-20 token.
 * BUT as native gas (msg.value), Arc uses 18-decimal wei internally.
 * So 1 USDC = 1_000_000 in ERC-20 units = 1_000_000_000_000_000_000 wei (1e18).
 * Therefore:
 *   0.05 USDC = 50_000 ERC-20 units = 50_000 * 1e12 = 5e16 wei
 *   0.10 USDC = 100_000 ERC-20 units = 100_000 * 1e12 = 1e17 wei
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

interface IERC1155 {
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data) external;
}

struct PermitDetails {
    address token;
    uint160 amount;
    uint48  expiration;
    uint48  nonce;
}

struct PermitBatch {
    PermitDetails[] details;
    address         spender;
    uint256         sigDeadline;
}

interface IPermit2 {
    function permit(
        address owner,
        PermitBatch calldata permitBatch,
        bytes calldata signature
    ) external;

    function transferFrom(
        address from,
        address to,
        uint160 amount,
        address token
    ) external;
}

contract ArcSender {

    address public immutable owner;
    uint256 public constant MAX_RECIPIENTS = 200;

    // Permit2 on Arc Testnet
    address public constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // Fee tiers by recipient count
    uint256 public constant FREE_TIER_MAX = 50;
    uint256 public constant MID_TIER_MAX  = 100;

    // Fee in native wei (Arc: 1 USDC = 1e18 wei, USDC has 6 decimals)
    // 0.05 USDC = 50_000 * 1e12 = 5e16 wei
    // 0.10 USDC = 100_000 * 1e12 = 1e17 wei
    uint256 public constant FEE_MID  = 5e16;
    uint256 public constant FEE_HIGH = 1e17;

    error NotOwner();
    error TooManyRecipients(uint256 count, uint256 max);
    error ArrayLengthMismatch();
    error InsufficientFee(uint256 required, uint256 provided);
    error TransferFailed();
    error WithdrawFailed();
    error ZeroRecipients();

    event TokensSent(address indexed token, address indexed sender, uint256 recipientCount);
    event Erc721Sent(address indexed token, address indexed sender, uint256 recipientCount);
    event Erc1155Sent(address indexed token, address indexed sender, uint256 recipientCount);
    event FeeReceived(address indexed sender, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Returns required fee in wei for a given recipient count
    function getFee(uint256 count) public pure returns (uint256) {
        if (count <= FREE_TIER_MAX) return 0;
        if (count <= MID_TIER_MAX)  return FEE_MID;
        return FEE_HIGH;
    }

    function _chargeFee(uint256 count) internal {
        uint256 required = getFee(count);
        if (required == 0) return;
        if (msg.value < required) revert InsufficientFee(required, msg.value);
        emit FeeReceived(msg.sender, msg.value);
    }

    // ════════════════════════════════════════════════════════
    //  ERC-20 MULTISEND — original direct transferFrom
    //  UNCHANGED
    // ════════════════════════════════════════════════════════

    function multisend(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable {
        uint256 count = recipients.length;
        if (count == 0)              revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)  revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length) revert ArrayLengthMismatch();

        _chargeFee(count);
        IERC20 erc20 = IERC20(token);
        for (uint256 i = 0; i < count; ) {
            if (!erc20.transferFrom(msg.sender, recipients[i], amounts[i]))
                revert TransferFailed();
            unchecked { ++i; }
        }
        emit TokensSent(token, msg.sender, count);
    }

    // ════════════════════════════════════════════════════════
    //  ERC-20 MULTISEND — Permit2 version (TRUE 2-INTERACTION)
    //
    //  Flow:
    //    1. User signs EIP-712 PermitBatch (gasless, popup 1)
    //    2. Frontend calls this function with the signature
    //       → contract submits permit2.permit() on-chain
    //       → contract calls permit2.transferFrom() for each row
    //       All in ONE transaction (popup 2)
    //
    //  One-time prerequisite per token (handled at wallet connect):
    //    token.approve(PERMIT2, type(uint256).max)
    //
    //  Fee is paid via msg.value (native USDC wei).
    //  Frontend must compute getFee(count) and pass as value.
    // ════════════════════════════════════════════════════════

    function multisendPermit2(
        PermitBatch calldata permitBatch,
        bytes calldata signature,
        address[] calldata tokens,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable {
        uint256 count = recipients.length;
        if (count == 0)              revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)  revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length || count != tokens.length)
            revert ArrayLengthMismatch();

        _chargeFee(count);

        IPermit2 p2 = IPermit2(PERMIT2);

        // Submit the signed permit — grants Permit2 allowances to this contract
        p2.permit(msg.sender, permitBatch, signature);

        // Transfer all tokens using the newly granted allowances
        for (uint256 i = 0; i < count; ) {
            p2.transferFrom(
                msg.sender,
                recipients[i],
                uint160(amounts[i]),
                tokens[i]
            );
            unchecked { ++i; }
        }

        emit TokensSent(address(0), msg.sender, count);
    }

    // ════════════════════════════════════════════════════════
    //  ERC-721 (PAYABLE) — UNCHANGED
    // ════════════════════════════════════════════════════════

    function multisendERC721(
        address token,
        address[] calldata recipients,
        uint256[] calldata tokenIds
    ) external payable {
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
    //  ERC-721 (FREE) — UNCHANGED
    // ════════════════════════════════════════════════════════

    function freeMultisendERC721(
        address token,
        address[] calldata recipients,
        uint256[] calldata tokenIds
    ) external {
        uint256 count = recipients.length;
        if (count == 0)               revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)   revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != tokenIds.length) revert ArrayLengthMismatch();

        IERC721 nft = IERC721(token);
        for (uint256 i = 0; i < count; ) {
            nft.safeTransferFrom(msg.sender, recipients[i], tokenIds[i]);
            unchecked { ++i; }
        }
        emit Erc721Sent(token, msg.sender, count);
    }

    // ════════════════════════════════════════════════════════
    //  ERC-1155 one ID per recipient (PAYABLE) — UNCHANGED
    // ════════════════════════════════════════════════════════

    function multisendERC1155(
        address token,
        address[] calldata recipients,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external payable {
        uint256 count = recipients.length;
        if (count == 0)                                     revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)                         revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != ids.length || count != amounts.length) revert ArrayLengthMismatch();

        _chargeFee(count);
        IERC1155 nft = IERC1155(token);
        for (uint256 i = 0; i < count; ) {
            nft.safeTransferFrom(msg.sender, recipients[i], ids[i], amounts[i], "");
            unchecked { ++i; }
        }
        emit Erc1155Sent(token, msg.sender, count);
    }

    // ════════════════════════════════════════════════════════
    //  ERC-1155 one ID per recipient (FREE) — UNCHANGED
    // ════════════════════════════════════════════════════════

    function freeMultisendERC1155(
        address token,
        address[] calldata recipients,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        uint256 count = recipients.length;
        if (count == 0)                                     revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)                         revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != ids.length || count != amounts.length) revert ArrayLengthMismatch();

        IERC1155 nft = IERC1155(token);
        for (uint256 i = 0; i < count; ) {
            nft.safeTransferFrom(msg.sender, recipients[i], ids[i], amounts[i], "");
            unchecked { ++i; }
        }
        emit Erc1155Sent(token, msg.sender, count);
    }

    // ════════════════════════════════════════════════════════
    //  ERC-1155 multiple IDs to one recipient (PAYABLE) — UNCHANGED
    // ════════════════════════════════════════════════════════

    function batchToOneERC1155(
        address token,
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external payable {
        uint256 count = ids.length;
        if (count == 0)              revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)  revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length) revert ArrayLengthMismatch();

        _chargeFee(count);
        IERC1155(token).safeBatchTransferFrom(msg.sender, recipient, ids, amounts, "");
        emit Erc1155Sent(token, msg.sender, 1);
    }

    // ════════════════════════════════════════════════════════
    //  ERC-1155 multiple IDs to one recipient (FREE) — UNCHANGED
    // ════════════════════════════════════════════════════════

    function freeBatchToOneERC1155(
        address token,
        address recipient,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external {
        uint256 count = ids.length;
        if (count == 0)              revert ZeroRecipients();
        if (count > MAX_RECIPIENTS)  revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length) revert ArrayLengthMismatch();

        IERC1155(token).safeBatchTransferFrom(msg.sender, recipient, ids, amounts, "");
        emit Erc1155Sent(token, msg.sender, 1);
    }

    // ── Owner ─────────────────────────────────────────────────

    receive() external payable {
        if (msg.value > 0) emit FeeReceived(msg.sender, msg.value);
    }

    function withdraw() external {
        if (msg.sender != owner) revert NotOwner();
        uint256 bal = address(this).balance;
        if (bal == 0) return;
        (bool ok,) = payable(owner).call{value: bal}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(owner, bal);
    }

    function withdrawAmount(uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        if (amount == 0) return;
        (bool ok,) = payable(owner).call{value: amount}("");
        if (!ok) revert WithdrawFailed();
        emit Withdrawn(owner, amount);
    }

    function recoverERC20(address token, address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
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
