import { ethers } from "ethers"


const ABI = [
  "function getBuyPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)",
  "function buyShares(uint256 tokenId, uint256 amount, uint256 maxSpend) payable"
];

const CONTRACT_ADDRESS = "0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F"
const Target = "0x"

const privateKey = "bcb59865e0328338b447fbef8cc92c5ac2b1a4fee2535d960021bb71f43658f1"

  

async function startBot() {

      const provider = new ethers.WebSocketProvider("wss://rpc.ankr.com/base/ws/6c568ec2a0e373914db0b6bd31dae10037f29b3301c3fc4dd2f85101829a5cac")

    const wallet = new ethers.Wallet(privateKey, provider);

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    console.log("Start Bot")

    provider.on("pending", async (txHash) => {
        try {
            // Fetch the full transaction details
            let tx = await provider.getTransaction(txHash);


            if (!tx) {
        // Wait 1000ms (1 second)
        await new Promise(resolve => setTimeout(resolve, 1500));
        tx = await provider.getTransaction(txHash);

       
    }


            // Optimization: tx might be null if mined/dropped instantly
            if (!tx || !tx.to) return;

          

            // 5. FILTER: Is thiqs interaction with our Target Contract?
            if (tx.to.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() || tx.from.toLowerCase() === Target.toLowerCase()) {
                console.log("A contract")

                console.log(tx)
                // 6. DECODE: Is it the "createRoom()" function?
                if (tx.data.toLowerCase().startsWith("0x0a43b5c0".toLowerCase())) {
                    
                    console.log(`[🚨 ALERT] Match found! Hash: ${txHash}`);
                    console.log(`[Analysis] User ${tx.from} is creating a room.`);

                    const victimGasPrice = tx.gasPrice;
                    const bribeGasPrice = victimGasPrice + ethers.parseUnits("50", "gwei");

                    console.log(`[Attack] Sending Buy Tx with Gas: ${ethers.formatUnits(bribeGasPrice, 'gwei')} gwei`);

                    const aggressivePriorityFee = ethers.parseUnits("2", "gwei"); 
const baseFeeEstimate = ethers.parseUnits("0.3", "gwei"); // Slightly above current base
      
               const _tx = await contract.buyShares!(
             305,
                1,
             100000000,
             {
        maxPriorityFeePerGas: aggressivePriorityFee, 
        maxFeePerGas: baseFeeEstimate + aggressivePriorityFee,
        gasLimit: 250000 
    }
);

                    console.log(`[Attack] 🔫 Bullet fired! Tx Hash: ${_tx.hash}`);
                }
            } else {
                console.log("Not Seen")
            }
        } catch (err) {
            // Ignore errors (common in mempool scanning due to dropped txs)
        }
    });
}

export default startBot