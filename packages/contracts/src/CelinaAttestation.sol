// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title CelinaAttestation
/// @notice On-chain record of Celina research verdicts. After every /ask
///         session that reaches synthesize, the Consumer wallet calls
///         attest() with a keccak256 hash of the canonical verdict JSON
///         and a short human-readable verdict string. One row per
///         sessionHash, double-attest is rejected. The event log is the
///         audit trail anyone can query from OKLink.
contract CelinaAttestation {
    struct Attestation {
        address attester;
        uint64 timestamp;
        bytes32 verdictHash;
        string verdict;
    }

    mapping(bytes32 => Attestation) private _attestations;
    uint256 public totalAttestations;

    event Attested(
        bytes32 indexed sessionHash,
        address indexed attester,
        uint64 timestamp,
        bytes32 verdictHash,
        string verdict
    );

    error AlreadyAttested(bytes32 sessionHash);
    error InvalidVerdict();

    function attest(
        bytes32 sessionHash,
        bytes32 verdictHash,
        string calldata verdict
    ) external {
        if (_attestations[sessionHash].timestamp != 0) {
            revert AlreadyAttested(sessionHash);
        }
        // Protect against empty-string abuse. Verdict must fit in one
        // sentence; anything > 512 bytes is almost certainly wrong.
        bytes memory raw = bytes(verdict);
        if (raw.length == 0 || raw.length > 512) revert InvalidVerdict();

        _attestations[sessionHash] = Attestation({
            attester: msg.sender,
            timestamp: uint64(block.timestamp),
            verdictHash: verdictHash,
            verdict: verdict
        });

        unchecked {
            totalAttestations++;
        }

        emit Attested(
            sessionHash,
            msg.sender,
            uint64(block.timestamp),
            verdictHash,
            verdict
        );
    }

    function getAttestation(bytes32 sessionHash)
        external
        view
        returns (
            address attester,
            uint64 timestamp,
            bytes32 verdictHash,
            string memory verdict
        )
    {
        Attestation memory a = _attestations[sessionHash];
        return (a.attester, a.timestamp, a.verdictHash, a.verdict);
    }

    function isAttested(bytes32 sessionHash) external view returns (bool) {
        return _attestations[sessionHash].timestamp != 0;
    }
}
