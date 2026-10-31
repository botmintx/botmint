// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BotmintGenesis} from "../src/BotmintGenesis.sol";

/// @notice Broadcasts BotmintGenesis to Base Sepolia and writes the address into
///         deployments/base-sepolia.json. CI does not run this script. It reads
///         DEPLOYER_KEY and ADMIN from the environment and refuses unless
///         BOTMINT_DEPLOY_BASE_SEPOLIA=1. Do not commit a key.
interface DeployVm {
    function envOr(string calldata name, string calldata defaultValue) external view returns (string memory);
    function envUint(string calldata name) external view returns (uint256);
    function envAddress(string calldata name) external view returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
    function readFile(string calldata path) external view returns (string memory);
    function writeFile(string calldata path, string calldata data) external;
    function parseJsonString(string calldata json, string calldata key) external pure returns (string memory);
    function parseJsonUint(string calldata json, string calldata key) external pure returns (uint256);
    function toString(uint256 value) external pure returns (string memory);
    function toString(address value) external pure returns (string memory);
}

contract DeployBaseSepolia {
    DeployVm internal constant vm = DeployVm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);
    string internal constant FILE = "../deployments/base-sepolia.json";

    function run() external {
        string memory gate = vm.envOr("BOTMINT_DEPLOY_BASE_SEPOLIA", "0");
        require(
            keccak256(bytes(gate)) == keccak256(bytes("1")),
            "refusing deploy: set BOTMINT_DEPLOY_BASE_SEPOLIA=1 to broadcast to Base Sepolia"
        );
        uint256 key = vm.envUint("DEPLOYER_KEY");
        address admin = vm.envAddress("ADMIN");
        string memory prior = vm.readFile(FILE);
        string memory network = vm.parseJsonString(prior, ".network");
        uint256 chainId = vm.parseJsonUint(prior, ".chainId");
        string memory rpc = vm.parseJsonString(prior, ".rpcUrl");
        string memory gallery = vm.parseJsonString(prior, ".galleryBaseUrl");
        string memory rpcOverride = vm.envOr("BASE_SEPOLIA_RPC", "");
        if (bytes(rpcOverride).length != 0) rpc = rpcOverride;

        vm.startBroadcast(key);
        BotmintGenesis token = new BotmintGenesis(admin);
        vm.stopBroadcast();

        vm.writeFile(
            FILE,
            string.concat(
                "{\n",
                '  "network": ',
                quoted(network),
                ",\n",
                '  "chainId": ',
                vm.toString(chainId),
                ",\n",
                '  "contract": ',
                quoted(vm.toString(address(token))),
                ",\n",
                '  "rpcUrl": ',
                quoted(rpc),
                ",\n",
                '  "galleryBaseUrl": ',
                quoted(gallery),
                "\n}\n"
            )
        );
    }

    function quoted(string memory value) internal pure returns (string memory) {
        return string.concat('"', value, '"');
    }
}
