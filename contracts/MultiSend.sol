// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MultiSend
 * @notice Gas-optimized batch token distribution contract for Arc Testnet.
 *         Supports ERC-20 tokens (USDC, EURC) and native currency (ARC).
 *
 * @dev Deploy this contract to Arc Testnet and set the address in
 *      NEXT_PUBLIC_MULTISEND_CONTRACT_ADDRESS.
 *
 * IMPORTANT: Users must approve this contract to spend their tokens
 * before calling multisendToken. The dApp handles approval automatically.
 *
 * Maximum batch size: 200 recipients (enforced on-chain).
 */

interface IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function transfer(address to, uint256 amount) external returns (bool);
}

contract MultiSend {
    uint256 public constant MAX_RECIPIENTS = 200;

    event TokensSent(
        address indexed token,
        address indexed sender,
        uint256 totalAmount,
        uint256 recipientCount
    );

    event NativeSent(
        address indexed sender,
        uint256 totalAmount,
        uint256 recipientCount
    );

    error TooManyRecipients(uint256 count, uint256 max);
    error ArrayLengthMismatch();
    error TransferFailed(address recipient, uint256 amount);
    error InsufficientValue(uint256 required, uint256 provided);

    /**
     * @notice Batch transfer a single ERC-20 token to multiple recipients.
     * @param token    ERC-20 token contract address (USDC, EURC, etc.)
     * @param recipients Array of recipient addresses
     * @param amounts    Corresponding token amounts (in token base units)
     */
    function multisendToken(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        uint256 count = recipients.length;
        if (count > MAX_RECIPIENTS) revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length) revert ArrayLengthMismatch();

        uint256 totalAmount = 0;
        IERC20 erc20 = IERC20(token);

        for (uint256 i = 0; i < count; ) {
            bool ok = erc20.transferFrom(msg.sender, recipients[i], amounts[i]);
            if (!ok) revert TransferFailed(recipients[i], amounts[i]);
            totalAmount += amounts[i];
            unchecked { ++i; }
        }

        emit TokensSent(token, msg.sender, totalAmount, count);
    }

    /**
     * @notice Batch transfer native currency (ARC) to multiple recipients.
     * @param recipients Array of recipient addresses
     * @param amounts    Corresponding amounts in wei
     */
    function multisendNative(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external payable {
        uint256 count = recipients.length;
        if (count > MAX_RECIPIENTS) revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length) revert ArrayLengthMismatch();

        uint256 totalRequired = 0;
        for (uint256 i = 0; i < count; ) {
            totalRequired += amounts[i];
            unchecked { ++i; }
        }
        if (msg.value < totalRequired) revert InsufficientValue(totalRequired, msg.value);

        for (uint256 i = 0; i < count; ) {
            (bool ok,) = payable(recipients[i]).call{value: amounts[i]}("");
            if (!ok) revert TransferFailed(recipients[i], amounts[i]);
            unchecked { ++i; }
        }

        // Refund excess ETH/ARC
        uint256 excess = msg.value - totalRequired;
        if (excess > 0) {
            (bool ok,) = payable(msg.sender).call{value: excess}("");
            if (!ok) revert TransferFailed(msg.sender, excess);
        }

        emit NativeSent(msg.sender, totalRequired, count);
    }

    /**
     * @notice Batch transfer multiple different ERC-20 tokens.
     * @dev Each (tokens[i], recipients[i], amounts[i]) is an independent transfer.
     *      Caller must have approved all tokens beforehand.
     */
    function multisendMixed(
        address[] calldata tokens,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        uint256 count = recipients.length;
        if (count > MAX_RECIPIENTS) revert TooManyRecipients(count, MAX_RECIPIENTS);
        if (count != amounts.length || count != tokens.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < count; ) {
            bool ok = IERC20(tokens[i]).transferFrom(msg.sender, recipients[i], amounts[i]);
            if (!ok) revert TransferFailed(recipients[i], amounts[i]);
            unchecked { ++i; }
        }
    }

    /// @notice Reject plain ETH sends not part of multisendNative
    receive() external payable {
        revert("Use multisendNative");
    }
}
