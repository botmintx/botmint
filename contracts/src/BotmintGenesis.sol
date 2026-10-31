// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal ERC-721 whose token id is a Genesis bot id (1 through 10000).
///         The EAS provenance attestation is a separate record and is not minted here.
///         A minter may mint only after a confirmed payment. This contract does not take payment.
contract BotmintGenesis {
    uint256 public constant SUPPLY = 10000;
    bytes4 private constant _ERC721 = 0x80ac58cd;
    bytes4 private constant _ERC721_METADATA = 0x5b5e139f;
    bytes4 private constant _ERC165 = 0x01ffc9a7;
    bytes4 private constant _RECEIVED = 0x150b7a02;

    string public name = "Botmint Genesis";
    string public symbol = "BOTMINT";
    address public admin;

    mapping(address => bool) public minters;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _approvals;
    mapping(address => mapping(address => bool)) private _operators;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event MinterUpdated(address indexed minter, bool allowed);

    error NotAdmin();
    error NotMinter();
    error BadToken();
    error Exists();
    error NotHolder();
    error UnsafeReceiver();

    constructor(address admin_) {
        if (admin_ == address(0)) revert BadToken();
        admin = admin_;
        minters[admin_] = true;
        emit MinterUpdated(admin_, true);
    }

    function setMinter(address minter, bool allowed) external {
        if (msg.sender != admin) revert NotAdmin();
        if (minter == address(0)) revert BadToken();
        minters[minter] = allowed;
        emit MinterUpdated(minter, allowed);
    }

    function mint(address to, uint256 tokenId) external {
        if (!minters[msg.sender]) revert NotMinter();
        if (to == address(0) || tokenId == 0 || tokenId > SUPPLY) revert BadToken();
        if (_owners[tokenId] != address(0)) revert Exists();
        _balances[to] += 1;
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address holder = _owners[tokenId];
        if (holder == address(0)) revert BadToken();
        return holder;
    }

    function balanceOf(address holder) external view returns (uint256) {
        if (holder == address(0)) revert BadToken();
        return _balances[holder];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert BadToken();
        return "";
    }

    function approve(address spender, uint256 tokenId) external {
        address holder = _owners[tokenId];
        if (holder == address(0)) revert BadToken();
        if (msg.sender != holder && !_operators[holder][msg.sender]) revert NotHolder();
        _approvals[tokenId] = spender;
        emit Approval(holder, spender, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        if (_owners[tokenId] == address(0)) revert BadToken();
        return _approvals[tokenId];
    }

    function setApprovalForAll(address operator, bool allowed) external {
        if (operator == address(0)) revert BadToken();
        _operators[msg.sender][operator] = allowed;
        emit ApprovalForAll(msg.sender, operator, allowed);
    }

    function isApprovedForAll(address holder, address operator) external view returns (bool) {
        return _operators[holder][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        _move(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        _move(from, to, tokenId);
        _checkReceiver(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external {
        _move(from, to, tokenId);
        _checkReceiver(from, to, tokenId, data);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == _ERC721 || interfaceId == _ERC721_METADATA || interfaceId == _ERC165;
    }

    function _move(address from, address to, uint256 tokenId) private {
        address holder = _owners[tokenId];
        if (holder == address(0) || to == address(0)) revert BadToken();
        if (from != holder) revert NotHolder();
        if (msg.sender != holder && msg.sender != _approvals[tokenId] && !_operators[holder][msg.sender]) {
            revert NotHolder();
        }
        _approvals[tokenId] = address(0);
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function _checkReceiver(address from, address to, uint256 tokenId, bytes memory data) private {
        if (to.code.length == 0) return;
        (bool ok, bytes memory ret) = to.call(
            abi.encodeWithSelector(_RECEIVED, msg.sender, from, tokenId, data)
        );
        if (!ok || ret.length < 32) revert UnsafeReceiver();
        bytes4 result;
        assembly {
            result := mload(add(ret, 32))
        }
        if (result != _RECEIVED) revert UnsafeReceiver();
    }
}
