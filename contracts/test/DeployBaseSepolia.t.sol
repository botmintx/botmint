// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {DeployBaseSepolia} from "../script/DeployBaseSepolia.s.sol";

interface EnvVm {
    function setEnv(string calldata name, string calldata value) external;
}

contract DeployBaseSepoliaTest {
    function testRefusesWithoutGate() public {
        EnvVm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D).setEnv("BOTMINT_DEPLOY_BASE_SEPOLIA", "0");
        DeployBaseSepolia script = new DeployBaseSepolia();
        (bool ok,) = address(script).call(abi.encodeWithSignature("run()"));
        require(!ok, "script broadcast without the gate");
    }
}
