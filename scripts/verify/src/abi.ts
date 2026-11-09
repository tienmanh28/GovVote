// ABI tối thiểu (minimal ABI: chỉ những phần script cần) của GovVote.
// Đã đối chiếu với src/GovVote.sol và out/GovVote.sol/GovVote.json:
//   - struct Proposal: 8 trường, đúng tên và đúng thứ tự khai báo trong Solidity
//     (ABI encode tuple theo THỨ TỰ trường, nên sai thứ tự là đọc nhầm forVotes/againstVotes).
//   - event VoteCast: id và voter là indexed (nằm trong topics), support và weight nằm trong data.
// `as const` giúp viem suy ra kiểu TypeScript chính xác cho args và giá trị trả về.

/** event VoteCast(uint256 indexed id, address indexed voter, bool support, uint256 weight) */
export const voteCastEvent = {
  type: "event",
  name: "VoteCast",
  anonymous: false,
  inputs: [
    { name: "id", type: "uint256", indexed: true },
    { name: "voter", type: "address", indexed: true },
    { name: "support", type: "bool", indexed: false },
    { name: "weight", type: "uint256", indexed: false },
  ],
} as const;

export const govVoteAbi = [
  voteCastEvent,
  {
    // uint256 public proposalCount; => getter tự sinh
    type: "function",
    name: "proposalCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    // function getProposal(uint256 id) external view returns (Proposal memory)
    type: "function",
    name: "getProposal",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "proposer", type: "address" },
          { name: "title", type: "string" },
          { name: "description", type: "string" },
          { name: "createdBlock", type: "uint256" },
          { name: "snapshotBlock", type: "uint256" },
          { name: "deadlineBlock", type: "uint256" },
          { name: "forVotes", type: "uint256" },
          { name: "againstVotes", type: "uint256" },
        ],
      },
    ],
  },
] as const;
