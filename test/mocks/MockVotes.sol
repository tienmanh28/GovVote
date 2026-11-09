// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title MockVotesToken (CHỈ DÙNG TRONG TEST)
/// @notice Token IVotes có mint/burn tự do, dùng để chứng minh GovVote tính quorum theo tổng cung TẠI SNAPSHOT.
///
/// Vì sao cần mint/burn?
///   GovToken thật có tổng cung cố định 1.000.000 GOV (không mint sau deploy), nên tổng cung tại snapshot
///   và tổng cung hiện tại LUÔN bằng nhau. Với GovToken, một GovVote viết sai (đọc tổng cung hiện tại)
///   vẫn cho cùng con số và mọi test vẫn pass => lỗi bị che. Muốn phân biệt hai cách đọc, tổng cung phải
///   THAY ĐỔI sau snapshot, và chỉ một token có mint/burn mới làm được điều đó.
///   Tương tự, 10^24 (1.000.000 GOV) * bps luôn chia hết cho 10^4, nên muốn thấy nhánh làm tròn lên thì
///   phải dựng được tổng cung lẻ như 999 đơn vị.
///
/// Vì sao KHÔNG BAO GIỜ đưa mock này lên testnet/mainnet?
///   - mint/burn là external và KHÔNG có kiểm soát quyền: bất kỳ ai cũng tự mint voting power vô hạn
///     hoặc đốt token của người khác. Một GovVote trỏ vào token này không có ý nghĩa quản trị nào.
///   - Đặc tả mục 4.2: "Không đưa mock lên testnet như token thật". Mock nằm trong test/ (không nằm
///     trong src/) và script deploy chỉ dùng GovToken.
contract MockVotesToken is ERC20, ERC20Votes {
    /// @dev EIP712 bắt buộc vì ERC20Votes -> Votes -> EIP712 (giống GovToken).
    constructor() ERC20("Mock GOV", "mGOV") EIP712("Mock GOV", "1") {}

    /// @notice Mint tự do (chỉ trong test). Ghi checkpoint tổng cung qua _update.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Burn tự do (chỉ trong test). Ghi checkpoint tổng cung qua _update.
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    /// @dev Giống GovToken: ERC20 và ERC20Votes cùng định nghĩa _update, phải override cả hai.
    ///      ERC20Votes._update cập nhật số dư (qua ERC20) rồi ghi checkpoint voting power và tổng cung.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }
}
