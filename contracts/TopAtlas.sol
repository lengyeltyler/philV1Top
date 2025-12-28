// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./lib/SSTORE2.sol";

contract TopAtlas {
    // Each entry is an SSTORE2 pointer (contract address)
    address[] public ptrs;
    string[] public names;

    constructor(address[] memory _ptrs, string[] memory _names) {
        require(_ptrs.length == _names.length, "len mismatch");
        ptrs = _ptrs;
        names = _names;
    }

    function count() external view returns (uint256) {
        return ptrs.length;
    }

    function getBytes(uint256 i) external view returns (bytes memory) {
        return SSTORE2.read(ptrs[i]);
    }

    function getSvg(uint256 i) external view returns (string memory) {
        return string(SSTORE2.read(ptrs[i]));
    }

    /// @notice Browser-friendly: copy/paste into a browser URL bar to render the SVG.
    /// @return data:image/svg+xml;base64,...
    function svgDataUri(uint256 i) external view returns (string memory) {
        bytes memory raw = SSTORE2.read(ptrs[i]);
        return string.concat("data:image/svg+xml;base64,", Base64.encode(raw));
    }

    /// @notice Metadata wrapper (useful later when integrated into tokenURI flows).
    /// @return data:application/json;base64,...
    function tokenURI(uint256 i) external view returns (string memory) {
        bytes memory rawSvg = SSTORE2.read(ptrs[i]);
        string memory image = string.concat(
            "data:image/svg+xml;base64,",
            Base64.encode(rawSvg)
        );

        // Minimal JSON. (If you ever add quotes/newlines into names, we can JSON-escape.)
        bytes memory json = abi.encodePacked(
            '{"name":"',
            names[i],
            '","description":"Phil Top trait","image":"',
            image,
            '"}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(json));
    }
}

/// @notice Minimal Base64 encoder (Solady-style).
library Base64 {
    /// @dev Encodes `data` using the base64 encoding described in RFC 4648.
    function encode(bytes memory data) internal pure returns (string memory result) {
        if (data.length == 0) return "";

        // Base64 encoding table
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

        uint256 encodedLen = 4 * ((data.length + 2) / 3);

        result = new string(encodedLen + 32);

        assembly {
            // Prepare the lookup table
            let tablePtr := add(table, 1)

            // result pointer, jump over length
            let resultPtr := add(result, 32)

            // data pointer
            let dataPtr := data
            let endPtr := add(dataPtr, mload(data))

            for {} lt(dataPtr, endPtr) {}
            {
                dataPtr := add(dataPtr, 3)
                let input := mload(dataPtr)

                // Write 4 characters
                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))
                resultPtr := add(resultPtr, 1)
            }

            // Padding with '='
            switch mod(mload(data), 3)
            case 1 {
                // last two chars are padding
                mstore8(sub(resultPtr, 1), 0x3d) // '='
                mstore8(sub(resultPtr, 2), 0x3d) // '='
            }
            case 2 {
                // last char is padding
                mstore8(sub(resultPtr, 1), 0x3d) // '='
            }

            // Set the actual output length
            mstore(result, encodedLen)
        }
    }
}