import { ethers } from "ethers";

const ABI = [
  "function getBuyPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)",
  "function buyShares(uint256 tokenId, uint256 amount, uint256 maxSpend) payable"
];

const rpcUrl = "https://rpc.ankr.com/base/6c568ec2a0e373914db0b6bd31dae10037f29b3301c3fc4dd2f85101829a5cac"

export async function autoBuyShares({
  privateKey,
  tokenId,
  amount,
  CONTRACT_ADDRESS,
}: {
  privateKey: string;
  tokenId: number;
  amount: number;
  CONTRACT_ADDRESS: string;
}) {
    const slippagePercent = 5
  // Provider & wallet
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    ABI,
    wallet
  );

  if (contract == undefined) {
    console.log("Contract not found");
    throw new Error("Contract not found");
  }

  // 1️⃣ Get base price (before fees)
  const basePrice: bigint = await contract.getBuyPriceAfterFee!(tokenId, amount);

  // 2️⃣ Apply slippage protection
  const maxSpend =
    basePrice + (basePrice * BigInt(slippagePercent)) / 100n;

  // 3️⃣ Buy shares
  const tx = await contract.buyShares!(
    tokenId,
    amount,
    basePrice
  );

  console.log("⏳ Transaction sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed:", receipt.hash);

  return receipt;
}
