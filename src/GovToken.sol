// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title GovToken (GOV)
/// @notice Token quản trị của GovVote v1.1 (đặc tả mục 3.2).
///         - Tổng cung cố định 1.000.000 GOV, mint đúng một lần trong constructor.
///         - Không có owner, không có mint/burn/pause công khai, không upgrade.
///         - Voting power chỉ xuất hiện khi chủ token gọi delegate() (cho chính mình hoặc cho người khác).
///         - Clock mặc định của ERC20Votes là block.number; v1.1 KHÔNG override clock.
contract GovToken is ERC20, ERC20Votes {
    /// @notice Tổng cung cố định: 1.000.000 GOV với 18 decimals (1 ether = 10^18 đơn vị nhỏ nhất).
    uint256 public constant TOTAL_SUPPLY = 1_000_000 ether;

    /// @param recipient Địa chỉ nhận toàn bộ tổng cung. Được truyền vào rõ ràng từ script deploy,
    ///        không tự suy ra từ msg.sender (đặc tả mục 2.1).
    ///        Nếu recipient = address(0), ERC20._mint tự revert ERC20InvalidReceiver(address(0)),
    ///        nên không cần thêm kiểm tra riêng.
    ///
    /// Vì sao phải gọi EIP712("GovVote Token", "1")?
    ///   ERC20Votes kế thừa Votes, mà Votes kế thừa EIP712 (abstract contract có constructor nhận tham số).
    ///   Solidity bắt buộc contract cuối cùng phải truyền tham số cho constructor của mọi contract cha
    ///   có tham số, nếu không sẽ lỗi biên dịch. EIP712 dựng "domain separator" (mã định danh miền ký)
    ///   từ name, version, chainId và địa chỉ contract. delegateBySig() của Votes dùng domain này để
    ///   xác minh chữ ký off-chain, nên chữ ký cho token này không thể bị dùng lại ở contract/chain khác.
    ///   v1.1 đã BỎ ERC20Permit, nhưng vẫn GIỮ EIP712 vì Votes cần nó.
    constructor(address recipient) ERC20("GovVote Token", "GOV") EIP712("GovVote Token", "1") {
        // Lần mint duy nhất trong vòng đời token. Sau constructor không còn đường nào gọi _mint
        // vì contract không có hàm public/external nào bọc _mint.
        _mint(recipient, TOTAL_SUPPLY);
    }

    /// @dev Vì sao phải override _update?
    ///   Cả ERC20 và ERC20Votes đều định nghĩa _update(from, to, value). Khi kế thừa từ hai contract
    ///   cùng có một hàm virtual, Solidity bắt contract con phải override và liệt kê rõ cả hai
    ///   trong override(ERC20, ERC20Votes) để không có nhập nhằng.
    ///
    ///   super._update(...) đi theo thứ tự C3 linearization (thứ tự tuyến tính hóa kế thừa):
    ///   GovToken -> ERC20Votes -> ERC20. Tức là ERC20Votes._update chạy trước, nó gọi
    ///   super._update (ERC20) để cập nhật số dư/tổng cung, rồi:
    ///     1. Nếu là mint (from == 0): kiểm tra tổng cung không vượt type(uint208).max.
    ///     2. Gọi _transferVotingUnits(from, to, value): ghi checkpoint (bản ghi voting power theo block)
    ///        cho tổng cung, và chuyển voting power từ delegatee của `from` sang delegatee của `to`.
    ///        Nếu một bên chưa delegate (delegatee = address(0)) thì phía đó không có checkpoint nào thay đổi.
    ///   Không thêm logic riêng ở đây: chỉ cần nối đúng chuỗi kế thừa.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }
}
