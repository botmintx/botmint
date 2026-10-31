// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BotmintGenesis} from "../src/BotmintGenesis.sol";

contract BotmintGenesisTest {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);

    function testAdminIsMinterAndOwnsToken() public {
        BotmintGenesis token = new BotmintGenesis(address(this));
        token.mint(ALICE, 1);
        require(token.ownerOf(1) == ALICE, "owner");
        require(token.balanceOf(ALICE) == 1, "balance");
    }

    function testStrangerCannotMint() public {
        BotmintGenesis token = new BotmintGenesis(ALICE);
        (bool ok,) = address(token).call(abi.encodeWithSelector(token.mint.selector, BOB, 1));
        require(!ok, "stranger minted");
    }

    function testGrantedMinterCanMint() public {
        BotmintGenesis token = new BotmintGenesis(address(this));
        token.setMinter(BOB, true);
        vmPrank(BOB);
        token.mint(ALICE, 42);
        require(token.ownerOf(42) == ALICE, "granted");
    }

    function testRejectsEmptyDoubleAndOutOfRange() public {
        BotmintGenesis token = new BotmintGenesis(address(this));
        require(!tryMint(token, address(0), 1), "zero to");
        require(!tryMint(token, ALICE, 0), "zero id");
        require(!tryMint(token, ALICE, 10001), "over supply");
        token.mint(ALICE, 7);
        require(!tryMint(token, BOB, 7), "double");
        token.mint(ALICE, 10000);
        require(token.ownerOf(10000) == ALICE, "last");
    }

    function testTransferUpdatesOwner() public {
        BotmintGenesis token = new BotmintGenesis(address(this));
        token.mint(ALICE, 9);
        vmPrank(ALICE);
        token.transferFrom(ALICE, BOB, 9);
        require(token.ownerOf(9) == BOB, "moved");
        require(token.balanceOf(ALICE) == 0, "alice");
        require(token.balanceOf(BOB) == 1, "bob");
    }

    function tryMint(BotmintGenesis token, address to, uint256 tokenId) internal returns (bool) {
        (bool ok,) = address(token).call(abi.encodeWithSelector(token.mint.selector, to, tokenId));
        return ok;
    }

    function vmPrank(address sender) internal {
        // Foundry cheatcode address. No forge-std dependency.
        (bool ok,) = address(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D).call(
            abi.encodeWithSignature("prank(address)", sender)
        );
        require(ok, "prank");
    }
}
