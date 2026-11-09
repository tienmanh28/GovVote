// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title GovVote
/// @notice Hợp đồng bỏ phiếu on-chain cho DAO, GovVote v1.1 (đặc tả mục 3.3 - 3.6).
///         - Token-weighted voting: trọng số = voting power đã delegate tại snapshotBlock.
///         - Mọi mốc thời gian theo block.number (khớp clock mặc định của ERC20Votes).
///         - Không owner, không execute, không Abstain; cấu hình là immutable.
/// @dev Interface nghiệp vụ đầy đủ theo mục 3.3: propose, castVote, state, getProposal, quorumVotes,
///      getVotingPowerAt (+ getter tự sinh proposalCount, hasVoted).
contract GovVote {
    // =========================================================================
    //                                  KIỂU DỮ LIỆU
    // =========================================================================

    /// @notice Vòng đời proposal (mục 2.3). Không có Executed trong v1.1.
    ///  Pending   : block.number <= snapshotBlock
    ///  Active    : snapshotBlock < block.number <= deadlineBlock
    ///  Succeeded : block.number > deadlineBlock, đạt quorum và For > Against
    ///  Defeated  : block.number > deadlineBlock, các trường hợp còn lại
    enum State {
        Pending,
        Active,
        Succeeded,
        Defeated
    }

    /// @notice Dữ liệu một proposal (đúng các trường ở mục 3.3).
    struct Proposal {
        address proposer; // ví tạo proposal
        string title; // 1..100 bytes UTF-8
        string description; // 0..1000 bytes UTF-8
        uint256 createdBlock; // block gọi propose()
        uint256 snapshotBlock; // block chốt voting power = createdBlock + votingDelayBlocks
        uint256 deadlineBlock; // block cuối cùng nhận phiếu = snapshotBlock + votingPeriodBlocks
        uint256 forVotes; // tổng trọng số phiếu For
        uint256 againstVotes; // tổng trọng số phiếu Against
    }

    // =========================================================================
    //                                    HẰNG SỐ
    // =========================================================================

    /// @notice Độ dài tối đa của title, đo bằng bytes UTF-8 (không phải số ký tự).
    uint256 public constant MAX_TITLE_BYTES = 100;
    /// @notice Độ dài tối đa của description, đo bằng bytes UTF-8.
    uint256 public constant MAX_DESCRIPTION_BYTES = 1000;
    /// @notice Mẫu số của basis point: 10.000 bps = 100%, 1.000 bps = 10%.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // =========================================================================
    //                          CẤU HÌNH BẤT BIẾN (immutable)
    // =========================================================================
    // immutable: gán một lần trong constructor, sau đó được nhúng thẳng vào bytecode.
    // Không ai (kể cả deployer) đổi được sau deploy => không cần owner (mục 3.7).
    // Tên giữ đúng đặc tả 3.3 vì đây là getter public mà frontend sẽ gọi.

    /// @notice Token cung cấp voting power (GovToken ở thực tế, MockVotes trong test supply).
    IVotes public immutable token;
    /// @notice Voting power tối thiểu (tại block.number - 1) để được tạo proposal.
    uint256 public immutable proposalThreshold;
    /// @notice Quorum theo basis point trên tổng cung tại snapshot (1000 = 10%).
    uint256 public immutable quorumBps;
    /// @notice Số block từ lúc tạo đến snapshot (0 = snapshot ngay tại block tạo).
    uint256 public immutable votingDelayBlocks;
    /// @notice Số block nhận phiếu sau snapshot.
    uint256 public immutable votingPeriodBlocks;

    // =========================================================================
    //                                    STORAGE
    // =========================================================================

    /// @notice Số proposal đã tạo; cũng là id lớn nhất. id bắt đầu từ 1, nên id 0 không tồn tại.
    uint256 public proposalCount;

    /// @dev private: đọc qua getProposal() (Bước 4) thay vì getter tự sinh trả tuple khó dùng.
    mapping(uint256 id => Proposal) private proposals;

    /// @notice hasVoted[id][voter] = true sau khi voter đã bỏ phiếu cho proposal id (dùng ở Bước 4).
    mapping(uint256 id => mapping(address voter => bool)) public hasVoted;

    // =========================================================================
    //                                    EVENTS
    // =========================================================================

    /// @notice Phát ra khi tạo proposal. id và proposer là indexed để lọc log nhanh.
    event ProposalCreated(
        uint256 indexed id, address indexed proposer, uint256 snapshotBlock, uint256 deadlineBlock, string title
    );

    /// @notice Phát ra khi bỏ phiếu thành công (Bước 4). Script verify cộng lại weight từ event này.
    event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 weight);

    // =========================================================================
    //                                 CUSTOM ERRORS
    // =========================================================================
    // Custom error rẻ gas hơn revert string và frontend decode được theo selector.
    // Tham số đi kèm giúp frontend/test biết chính xác vì sao revert (ví dụ thiếu bao nhiêu GOV).

    /// @notice id = 0 hoặc id > proposalCount.
    error ProposalNotFound(uint256 id);
    /// @notice title rỗng (0 bytes).
    error EmptyTitle();
    /// @notice title dài hơn MAX_TITLE_BYTES; bytesLength là độ dài thực tế (bytes UTF-8).
    error TitleTooLong(uint256 bytesLength);
    /// @notice description dài hơn MAX_DESCRIPTION_BYTES; bytesLength là độ dài thực tế.
    error DescriptionTooLong(uint256 bytesLength);
    /// @notice voting power của người đề xuất tại block.number - 1 nhỏ hơn proposalThreshold.
    error BelowThreshold(uint256 votingPower, uint256 required);
    /// @notice Proposal không ở trạng thái Active khi bỏ phiếu; current là trạng thái hiện tại.
    error NotActive(uint256 id, State current);
    /// @notice voter đã bỏ phiếu cho proposal id.
    error AlreadyVoted(uint256 id, address voter);
    /// @notice voting power của voter tại snapshot bằng 0.
    error NoVotingPower(uint256 id, address voter);
    /// @notice Tham số constructor không hợp lệ.
    error InvalidConfiguration();
    /// @notice Cần dữ liệu tại snapshotBlock nhưng block đó chưa kết thúc (block.number <= snapshotBlock).
    error SnapshotNotFinalized(uint256 id, uint256 snapshotBlock);

    // =========================================================================
    //                                  CONSTRUCTOR
    // =========================================================================

    /// @param token_              Token IVotes (GovToken).
    /// @param proposalThreshold_  Ngưỡng tạo proposal, đơn vị nhỏ nhất (1.000 GOV = 1_000 ether).
    /// @param quorumBps_          Quorum theo bps, phải nằm trong [1, 10000].
    /// @param votingDelayBlocks_  Số block chờ trước snapshot, được phép bằng 0.
    /// @param votingPeriodBlocks_ Số block bỏ phiếu, phải > 0 (nếu = 0 thì không bao giờ Active).
    ///        votingDelayBlocks_ + votingPeriodBlocks_ phải <= type(uint48).max.
    constructor(
        IVotes token_,
        uint256 proposalThreshold_,
        uint256 quorumBps_,
        uint256 votingDelayBlocks_,
        uint256 votingPeriodBlocks_
    ) {
        if (address(token_) == address(0) || quorumBps_ == 0 || quorumBps_ > BPS_DENOMINATOR) {
            revert InvalidConfiguration();
        }

        // Giới hạn cửa sổ bỏ phiếu theo uint48:
        //   ERC20Votes lưu và tra checkpoint bằng timepoint uint48 (SafeCast.toUint48). Nếu snapshot vượt
        //   uint48.max thì getPastVotes/getPastTotalSupply luôn revert => proposal không bao giờ vote được.
        //
        // Viết để KHÔNG BAO GIỜ tràn số (|| dừng ngay ở điều kiện đúng đầu tiên - short-circuit):
        //   1. period == 0                       -> sai cấu hình.
        //   2. period > uint48.max               -> chặn trước, nếu không thì phép trừ ở (3) bị underflow
        //                                           và revert Panic 0x11 thay vì InvalidConfiguration.
        //   3. delay > uint48.max - period       -> tương đương delay + period > uint48.max, nhưng không cộng.
        //
        // Ghi chú: snapshot = block.number + delay, nên giới hạn này coi block.number là nhỏ so với 2^48
        // (khoảng 2,8 * 10^14 block, hàng chục triệu năm với block 12 giây).
        if (
            votingPeriodBlocks_ == 0 || votingPeriodBlocks_ > type(uint48).max
                || votingDelayBlocks_ > type(uint48).max - votingPeriodBlocks_
        ) {
            revert InvalidConfiguration();
        }

        token = token_;
        proposalThreshold = proposalThreshold_;
        quorumBps = quorumBps_;
        votingDelayBlocks = votingDelayBlocks_;
        votingPeriodBlocks = votingPeriodBlocks_;
    }

    // =========================================================================
    //                                    PROPOSE
    // =========================================================================

    /// @notice Tạo proposal mới (luồng mục 3.4). Không chuyển GOV hay ETH.
    /// @return id ID của proposal vừa tạo (bắt đầu từ 1, tăng liên tục).
    function propose(string calldata title, string calldata description) external returns (uint256 id) {
        // 1. Kiểm tra dữ liệu đầu vào (rẻ, không gọi ra ngoài) trước.
        //    bytes(s).length là số byte UTF-8, không phải số ký tự: "ệ" chiếm 3 bytes.
        uint256 titleLength = bytes(title).length;
        if (titleLength == 0) revert EmptyTitle();
        if (titleLength > MAX_TITLE_BYTES) revert TitleTooLong(titleLength);
        uint256 descriptionLength = bytes(description).length;
        if (descriptionLength > MAX_DESCRIPTION_BYTES) revert DescriptionTooLong(descriptionLength);

        // 2. Kiểm tra quyền đề xuất bằng voting power tại block TRƯỚC (block.number - 1):
        //    - getPastVotes chỉ chấp nhận block đã kết thúc; hỏi block.number sẽ revert ERC5805FutureLookup.
        //    - block trước đã chốt, không ai thay đổi được trong giao dịch hiện tại (ví dụ: vay token,
        //      delegate rồi propose trong cùng một block sẽ không được tính).
        //
        //    Không kiểm tra riêng block.number > 0: chỉ ở block 0 (genesis) thì block.number - 1 mới
        //    underflow, mà block 0 không chứa giao dịch nào; ngay cả việc deploy GovVote đã ở block >= 1,
        //    nên propose() luôn chạy ở block >= 1. Nếu bằng cách nào đó xảy ra, Solidity 0.8 tự revert
        //    (Panic 0x11 - tràn số) chứ không cho chạy sai.
        uint256 proposerVotes = token.getPastVotes(msg.sender, block.number - 1);
        if (proposerVotes < proposalThreshold) revert BelowThreshold(proposerVotes, proposalThreshold);

        // 3. Ghi storage. ++proposalCount: tăng trước rồi lấy giá trị => id đầu tiên là 1.
        id = ++proposalCount;
        uint256 snapshotBlock = block.number + votingDelayBlocks;
        uint256 deadlineBlock = snapshotBlock + votingPeriodBlocks;

        Proposal storage p = proposals[id];
        p.proposer = msg.sender;
        p.title = title;
        p.description = description;
        p.createdBlock = block.number;
        p.snapshotBlock = snapshotBlock;
        p.deadlineBlock = deadlineBlock;
        // forVotes và againstVotes mặc định = 0.

        // 4. Emit cuối cùng.
        emit ProposalCreated(id, msg.sender, snapshotBlock, deadlineBlock, title);
    }

    // =========================================================================
    //                                   CAST VOTE
    // =========================================================================

    /// @notice Bỏ phiếu For (support = true) hoặc Against (support = false) cho proposal đang Active.
    ///         Không chuyển hay khóa token: đây là bỏ phiếu theo trọng số, không phải staking (mục 3.5).
    /// @dev Thứ tự: KIỂM TRA (a-d) -> GHI storage (e) -> EMIT (f).
    ///      Mọi điều kiện được kiểm tra hết trước khi ghi, nên giao dịch revert không để lại trạng thái dở dang,
    ///      và event chỉ phát ra khi storage đã khớp với nó (script verify cộng VoteCast phải ra đúng tally).
    function castVote(uint256 id, bool support) external {
        // a. Proposal phải tồn tại (revert ProposalNotFound(id)).
        Proposal storage p = _existing(id);

        // b. Chỉ nhận phiếu khi Active: snapshotBlock < block.number <= deadlineBlock.
        //    Báo kèm trạng thái hiện tại để frontend giải thích "chưa mở" (Pending) hay "đã đóng".
        State current = _stateOf(p);
        if (current != State.Active) revert NotActive(id, current);

        // c. Mỗi địa chỉ chỉ vote một lần cho mỗi proposal (không bảo đảm 1 người thật = 1 phiếu).
        if (hasVoted[id][msg.sender]) revert AlreadyVoted(id, msg.sender);

        // d. Trọng số = voting power TẠI SNAPSHOT, không phải getVotes() (voting power hiện tại):
        //    - Snapshot đã chốt ở quá khứ, mọi voter của proposal được đo trên CÙNG một mốc, nên kết quả
        //      không phụ thuộc thứ tự hay thời điểm bỏ phiếu.
        //    - Nếu dùng getVotes(), một lượng GOV có thể được vote nhiều lần: A vote, chuyển token sang B,
        //      B delegate rồi vote tiếp với chính số token đó. Với snapshot, token nhận sau snapshot
        //      không có trọng số cho proposal này, còn người chuyển đi vẫn giữ trọng số đã chốt.
        //    - Token mua/vay SAU snapshot không dùng được. Giới hạn: snapshot KHÔNG chặn việc mua/vay
        //      TRƯỚC snapshot (mục 2.4), nên không được tuyên bố là chống mọi flash-loan.
        //    Đây là external call tới hàm khai báo view trong IVotes, nên Solidity dùng STATICCALL:
        //    token không thể ghi state trong lời gọi này. Chưa có thay đổi storage nào trước nó.
        uint256 weight = token.getPastVotes(msg.sender, p.snapshotBlock);
        if (weight == 0) revert NoVotingPower(id, msg.sender);

        // e. Ghi storage. Đánh dấu hasVoted TRƯỚC khi cộng phiếu:
        //    - Theo nguyên tắc CEI (Checks-Effects-Interactions): trạng thái "đã vote" phải được ghi ngay khi
        //      quyết định chấp nhận phiếu, để mọi đường đi sau đó (kể cả nếu sau này v2 thêm lời gọi ra ngoài
        //      hoặc hook) đều thấy voter này đã vote và không thể cộng phiếu lần hai.
        //    - Trong v1.1 không có lời gọi ra ngoài nào sau bước này, nên đây là phòng thủ theo thói quen,
        //      không phải vá một lỗ reentrancy đang tồn tại.
        hasVoted[id][msg.sender] = true;
        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        // f. Emit cuối cùng, sau khi storage đã cập nhật.
        emit VoteCast(id, msg.sender, support, weight);
    }

    // =========================================================================
    //                                  VIEW CÔNG KHAI
    // =========================================================================

    /// @notice Voting power của `account` dùng cho proposal `id` (= getPastVotes tại snapshotBlock).
    /// @dev Revert SnapshotNotFinalized khi block.number <= snapshotBlock: chưa chốt nên chưa có con số đúng.
    ///      Frontend trong Pending chỉ hiển thị "quyền dự kiến" từ getVotes() của token (mục 5.1).
    function getVotingPowerAt(uint256 id, address account) external view returns (uint256) {
        Proposal storage p = _existing(id);
        if (block.number <= p.snapshotBlock) revert SnapshotNotFinalized(id, p.snapshotBlock);
        return token.getPastVotes(account, p.snapshotBlock);
    }

    /// @notice Trạng thái hiện tại của proposal (mục 2.3, 3.6). Revert ProposalNotFound nếu id không tồn tại.
    /// @dev Trạng thái không lưu trong storage mà được TÍNH từ block.number mỗi lần gọi, nên không cần
    ///      giao dịch nào để "chuyển" Pending -> Active -> Succeeded/Defeated.
    function state(uint256 id) public view returns (State) {
        return _stateOf(_existing(id));
    }

    /// @notice Số phiếu (For + Against) tối thiểu để proposal đạt quorum.
    /// @dev Revert SnapshotNotFinalized khi block.number <= snapshotBlock: tổng cung tại snapshot chưa chốt,
    ///      getPastTotalSupply(snapshotBlock) sẽ revert ERC5805FutureLookup. Báo lỗi bằng error của GovVote
    ///      (kèm id và snapshotBlock) để frontend hiển thị "quorum chưa chốt, mở sau block X".
    function quorumVotes(uint256 id) public view returns (uint256) {
        Proposal storage p = _existing(id);
        if (block.number <= p.snapshotBlock) revert SnapshotNotFinalized(id, p.snapshotBlock);
        return _quorumAt(p.snapshotBlock);
    }

    /// @notice Toàn bộ dữ liệu của một proposal (copy từ storage sang memory).
    /// @dev _existing(id) đã trả về đúng con trỏ storage proposals[id]; return sẽ copy nó ra memory.
    function getProposal(uint256 id) external view returns (Proposal memory) {
        return _existing(id);
    }

    // =========================================================================
    //                                  NỘI BỘ
    // =========================================================================

    /// @dev Trả về proposal đang tồn tại, hoặc revert ProposalNotFound(id).
    ///      Mapping trong Solidity trả về struct rỗng cho mọi key chưa ghi, nên phải tự kiểm tra id
    ///      bằng proposalCount: id hợp lệ khi 1 <= id <= proposalCount.
    function _existing(uint256 id) internal view returns (Proposal storage p) {
        if (id == 0 || id > proposalCount) revert ProposalNotFound(id);
        p = proposals[id];
    }

    /// @dev Tính trạng thái theo thứ tự điều kiện ở mục 3.6. Thứ tự quan trọng:
    ///      chỉ khi đã qua deadline mới đọc quorum, lúc đó snapshotBlock chắc chắn đã thuộc quá khứ
    ///      (snapshotBlock < deadlineBlock < block.number) nên _quorumAt không thể revert.
    function _stateOf(Proposal storage p) internal view returns (State) {
        // Pending: kể cả ĐÚNG TẠI snapshotBlock, vì block đó chưa kết thúc nên voting power chưa chốt.
        if (block.number <= p.snapshotBlock) return State.Pending;
        // Active: từ snapshotBlock + 1 đến hết deadlineBlock (block deadline vẫn nhận phiếu).
        if (block.number <= p.deadlineBlock) return State.Active;

        // Đã qua deadline: kết quả là cuối cùng vì tally không thể tăng thêm.
        // Quorum đo mức tham gia For + Against (quyết định v1.1, không có Abstain).
        uint256 participated = p.forVotes + p.againstVotes;
        if (participated >= _quorumAt(p.snapshotBlock) && p.forVotes > p.againstVotes) {
            return State.Succeeded;
        }
        // Thiếu quorum, hòa phiếu hoặc Against thắng đều là Defeated (không revert).
        return State.Defeated;
    }

    /// @dev quorum = ceil(totalSupply(snapshot) * quorumBps / 10000). Caller phải bảo đảm snapshot đã qua.
    ///
    ///      Vì sao làm tròn LÊN (Math.Rounding.Ceil)?
    ///        Phép chia nguyên trong Solidity cắt phần lẻ (làm tròn xuống). Nếu supply * bps không chia hết
    ///        cho 10000, làm tròn xuống sẽ cho ngưỡng THẤP HƠN tỷ lệ đã công bố, tức proposal có thể đạt
    ///        "10%" khi thực tế tham gia chưa tới 10%. Làm tròn lên bảo đảm participated >= quorum luôn có
    ///        nghĩa là participated / supply >= quorumBps / 10000.
    ///        Ví dụ: supply = 999 đơn vị, 10% = 99,9. Làm tròn xuống: 99 (= 9,9%, sai). Làm tròn lên: 100.
    ///
    ///      Vì sao dùng Math.mulDiv thay vì (supply * bps) / 10000?
    ///        mulDiv tính tích với độ chính xác 512-bit nên không tràn ở bước nhân, và hỗ trợ chọn chiều
    ///        làm tròn. Với GOV (1e24 * 1e4) phép nhân thường không tràn, nhưng mulDiv đúng với mọi IVotes.
    function _quorumAt(uint256 snapshotBlock) internal view returns (uint256) {
        return Math.mulDiv(token.getPastTotalSupply(snapshotBlock), quorumBps, BPS_DENOMINATOR, Math.Rounding.Ceil);
    }
}
