// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {VmSafe} from "forge-std/Vm.sol";
import {Test} from "forge-std/Test.sol";
import {StdConstants} from "forge-std/StdConstants.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {SeedDemo} from "../script/SeedDemo.s.sol";
import {GovToken} from "../src/GovToken.sol";
import {GovVote} from "../src/GovVote.sol";

/// @dev Chỉ EVM mô phỏng, không RPC. Set đủ env mỗi ca và khôi phục sau ca để tránh nhiễm chéo.
contract DeployScriptTest is Test {
    Deploy internal deploy;
    string[11] internal keys = [
        "EXPECTED_CHAIN_ID",
        "TOKEN_RECIPIENT",
        "PROPOSAL_THRESHOLD_GOV",
        "QUORUM_BPS",
        "VOTING_DELAY_BLOCKS",
        "VOTING_PERIOD_BLOCKS",
        "GOV_TOKEN",
        "DEMO_ALICE",
        "DEMO_BOB",
        "DEMO_CHARLIE",
        "DEMO_DAVID"
    ];

    modifier cleanEnv() {
        string[11] memory beforeValues;
        for (uint256 i; i < keys.length; i++) {
            beforeValues[i] = vm.envOr(keys[i], string(""));
        }
        _;
        // Cheatcode broadcast không rollback theo EVM revert; dọn context sau ca cố ý revert ở recipient guard.
        (VmSafe.CallerMode mode,,) = vm.readCallers();
        if (mode == VmSafe.CallerMode.Broadcast || mode == VmSafe.CallerMode.RecurrentBroadcast) vm.stopBroadcast();
        // setEnv không có unsetEnv: giá trị vắng mặt được khôi phục thành rỗng, envUint vẫn từ chối.
        for (uint256 i; i < keys.length; i++) {
            vm.setEnv(keys[i], beforeValues[i]);
        }
    }

    // vm.setEnv là state process dùng chung; gom các tình huống vào một test để tránh race khi forge chạy song song.
    // Mọi assertion của 11 tình huống vẫn chạy, không thay threads/fuzz hoặc test cũ.
    function test_DeployAndSeedGuardScenarios() public {
        case_LocalKeepsIndependentRecipient();
        case_SepoliaMintsAllToRealBroadcaster();
        case_ExpectedSepoliaActualLocalRevertsBeforeDeploy();
        case_ExpectedLocalActualSepoliaRevertsBeforeDeploy();
        case_RejectsMainnet();
        case_RejectsUnknownChain();
        case_RejectsZeroChain();
        case_MissingExpectedChainIdHasExplicitError();
        case_SepoliaRejectsRecipientDifferentFromBroadcaster();
        case_LocalSeedKeepsDistribution();
        case_SepoliaCannotSeedDemo();
    }

    function setUp() public {
        deploy = new Deploy();
    }

    function configure(uint256 chain, address recipient) internal {
        vm.setEnv("EXPECTED_CHAIN_ID", vm.toString(chain));
        vm.setEnv("TOKEN_RECIPIENT", vm.toString(recipient));
        vm.setEnv("PROPOSAL_THRESHOLD_GOV", "1000");
        vm.setEnv("QUORUM_BPS", "1000");
        vm.setEnv("VOTING_DELAY_BLOCKS", "15");
        vm.setEnv("VOTING_PERIOD_BLOCKS", "7200");
    }

    function checkDeployment(GovToken token, GovVote gov, address recipient) internal view {
        assertGt(address(token).code.length, 0);
        assertGt(address(gov).code.length, 0);
        assertEq(token.totalSupply(), 1_000_000 ether);
        assertEq(token.balanceOf(recipient), token.totalSupply());
        assertEq(address(gov.token()), address(token));
        assertEq(gov.proposalThreshold(), 1000 ether);
        assertEq(gov.quorumBps(), 1000);
        assertEq(gov.votingDelayBlocks(), 15);
        assertEq(gov.votingPeriodBlocks(), 7200);
    }

    function case_LocalKeepsIndependentRecipient() internal cleanEnv {
        vm.chainId(31337);
        address recipient = address(0xBEEF);
        configure(31337, recipient);
        (GovToken token, GovVote gov) = deploy.run();
        checkDeployment(token, gov, recipient);
        assertEq(token.balanceOf(StdConstants.DEFAULT_SENDER), 0);
    }

    function case_SepoliaMintsAllToRealBroadcaster() internal cleanEnv {
        vm.chainId(11155111);
        configure(11155111, StdConstants.DEFAULT_SENDER);
        // msg.sender tại Deploy.run là test contract, khác broadcaster thực do Foundry chọn.
        (GovToken token, GovVote gov) = deploy.run();
        checkDeployment(token, gov, StdConstants.DEFAULT_SENDER);
        assertEq(token.balanceOf(address(this)), 0);
        assertEq(token.balanceOf(address(deploy)), 0);
        assertEq(token.balanceOf(address(0xBEEF)), 0);
    }

    function expectNoDeployment(bytes memory errorData) internal {
        address sender = StdConstants.DEFAULT_SENDER;
        uint64 nonce = vm.getNonce(sender);
        address first = vm.computeCreateAddress(sender, nonce);
        address second = vm.computeCreateAddress(sender, nonce + 1);
        vm.recordLogs();
        vm.expectRevert(errorData);
        deploy.run();
        assertEq(vm.getNonce(sender), nonce);
        assertEq(first.code.length, 0);
        assertEq(second.code.length, 0);
        assertEq(vm.getRecordedLogs().length, 0);
    }

    function case_ExpectedSepoliaActualLocalRevertsBeforeDeploy() internal cleanEnv {
        vm.chainId(31337);
        configure(11155111, StdConstants.DEFAULT_SENDER);
        expectNoDeployment(abi.encodeWithSelector(Deploy.DeploymentChainMismatch.selector, 11155111, 31337));
    }

    function case_ExpectedLocalActualSepoliaRevertsBeforeDeploy() internal cleanEnv {
        vm.chainId(11155111);
        configure(31337, StdConstants.DEFAULT_SENDER);
        expectNoDeployment(abi.encodeWithSelector(Deploy.DeploymentChainMismatch.selector, 31337, 11155111));
    }

    function case_RejectsMainnet() internal cleanEnv {
        configure(1, StdConstants.DEFAULT_SENDER);
        expectNoDeployment(abi.encodeWithSelector(Deploy.UnsupportedExpectedChainId.selector, 1));
    }

    function case_RejectsUnknownChain() internal cleanEnv {
        configure(137, StdConstants.DEFAULT_SENDER);
        expectNoDeployment(abi.encodeWithSelector(Deploy.UnsupportedExpectedChainId.selector, 137));
    }

    function case_RejectsZeroChain() internal cleanEnv {
        configure(0, StdConstants.DEFAULT_SENDER);
        expectNoDeployment(abi.encodeWithSelector(Deploy.UnsupportedExpectedChainId.selector, 0));
    }

    function case_MissingExpectedChainIdHasExplicitError() internal cleanEnv {
        configure(31337, StdConstants.DEFAULT_SENDER);
        vm.setEnv("EXPECTED_CHAIN_ID", "");
        expectNoDeployment(abi.encodeWithSelector(Deploy.ExpectedChainIdRequired.selector));
    }

    function case_SepoliaRejectsRecipientDifferentFromBroadcaster() internal cleanEnv {
        vm.chainId(11155111);
        configure(11155111, address(this));
        expectNoDeployment(
            abi.encodeWithSelector(Deploy.SepoliaRecipientMismatch.selector, address(this), StdConstants.DEFAULT_SENDER)
        );
    }

    function case_LocalSeedKeepsDistribution() internal cleanEnv {
        vm.chainId(31337);
        GovToken token = new GovToken(address(this));
        vm.setEnv("GOV_TOKEN", vm.toString(address(token)));
        vm.setEnv("DEMO_ALICE", vm.toString(address(1)));
        vm.setEnv("DEMO_BOB", vm.toString(address(2)));
        vm.setEnv("DEMO_CHARLIE", vm.toString(address(3)));
        vm.setEnv("DEMO_DAVID", vm.toString(address(4)));
        new SeedDemo().run();
        assertEq(token.balanceOf(address(1)), 400_000 ether);
        assertEq(token.balanceOf(address(2)), 250_000 ether);
        assertEq(token.balanceOf(address(3)), 200_000 ether);
        assertEq(token.balanceOf(address(4)), 150_000 ether);
        assertEq(token.balanceOf(address(this)), 0);
        assertEq(token.getVotes(address(1)), 0);
    }

    function case_SepoliaCannotSeedDemo() internal cleanEnv {
        vm.chainId(11155111);
        SeedDemo seed = new SeedDemo();
        vm.expectRevert(abi.encodeWithSelector(SeedDemo.LocalDemoOnly.selector, 11155111));
        seed.run();
    }
}
