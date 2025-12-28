// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal SSTORE2 (Solmate-style) for storing arbitrary bytes in contract code.
/// @dev Writes data into runtime bytecode of a new contract. Reading uses extcodecopy.
library SSTORE2 {
    error WriteError();

    function write(bytes memory data) internal returns (address pointer) {
        // Prefix data with STOP (0x00) so it can't be executed as code.
        bytes memory runtime = abi.encodePacked(hex"00", data);

        // Creation code: return runtime.
        bytes memory creation = abi.encodePacked(
            hex"61", // PUSH2
            uint16(runtime.length),
            hex"80_60_0a_3d_39_3d_f3", // DUP1 PUSH1 0x0a RETURNDATASIZE CODECOPY RETURNDATASIZE RETURN
            runtime
        );

        assembly {
            pointer := create(0, add(creation, 0x20), mload(creation))
        }
        if (pointer == address(0)) revert WriteError();
    }

    function read(address pointer) internal view returns (bytes memory data) {
        assembly {
            let size := extcodesize(pointer)
            // runtime has a leading 0x00 byte
            let dataSize := sub(size, 1)

            data := mload(0x40)
            mstore(0x40, add(data, and(add(add(dataSize, 0x20), 0x1f), not(0x1f))))
            mstore(data, dataSize)

            extcodecopy(pointer, add(data, 0x20), 1, dataSize)
        }
    }
}