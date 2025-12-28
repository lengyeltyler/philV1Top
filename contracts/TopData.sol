// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./lib/SSTORE2.sol";

contract TopData {
    address public immutable pointer;

    constructor(bytes memory data) {
        pointer = SSTORE2.write(data);
    }

    function read() external view returns (bytes memory) {
        return SSTORE2.read(pointer);
    }
}