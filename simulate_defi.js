
require('dotenv').config();
const { ethers } = require("ethers");

// --- CONFIGURATION ---
// REPLACE WITH YOUR NEW DEPLOYED CONTRACT ADDRESS
const CONTRACT_ADDRESS = "0xD556b69EBfa536DfE16490B9bE3C991Ce46CECEd"; 
const RPC_URL = process.env.RPC_URL;

// Load Keys
const PRIVATE_KEYS_LIST = process.env.PRIVATE_KEYS
    ? process.env.PRIVATE_KEYS.split(',').map(key => key.trim())
    : [];

if (PRIVATE_KEYS_LIST.length === 0) {
    console.error("❌ Error: No private keys found in .env file");
    process.exit(1);
}

// Full ABI required for reading state
const ABI = [
    "function claimFreePoints() external",
    "function transferPoints(address to, uint256 amount) external",
    "function stakePoints(uint256 amount) external",
    "function unstakePoints(uint256 amount) external",
    "function setProfile(string calldata _username) external",
    "function balances(address) view returns (uint256)",
    "function stakedBalances(address) view returns (uint256)",
    "function lastClaimTime(address) view returns (uint256)",
    "function profiles(address) view returns (string username, uint256 createdAt, uint256 score)",
    "function CLAIM_AMOUNT() view returns (uint256)",
    "function COOLDOWN() view returns (uint256)"
];

const NAMES = ["Xedrah", "DML", "Jadon", "Nitzy", "Rollins", "Teni", "Micheal", "Royal"];

async function main() {
    console.log("🤖 STARTING DEFI SIMULATION BOT...");
    
    // Use Static Network for stability with public RPCs
    const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
    
    const wallets = PRIVATE_KEYS_LIST.map(key => new ethers.Wallet(key, provider));
    console.log(`✅ Loaded ${wallets.length} wallets.`);

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // --- INFINITE LOOP ---
    let round = 1;
    while (true) {
        console.log(`\n🔄 --- ROUND ${round} ---`);
        
        // Loop through every wallet in our list
        for (let i = 0; i < wallets.length; i++) {
            const wallet = wallets[i];
            const walletContract = contract.connect(wallet);
            const addressShort = `...${wallet.address.slice(-4)}`;

            try {
                // 1. GET DATA (Read State)
                const lastClaim = await contract.lastClaimTime(wallet.address);
                const balance = await contract.balances(wallet.address);
                const staked = await contract.stakedBalances(wallet.address);
                const profile = await contract.profiles(wallet.address);
                const cooldown = await contract.COOLDOWN();
                
                // Get current block timestamp (approximate)
                const now = Math.floor(Date.now() / 1000); 

                // --- DECISION TREE ---

                // DECISION 1: CLAIM POINTS
                // If enough time has passed (or it's the first time), CLAIM.
                if (BigInt(now) > (lastClaim + cooldown)) {
                    console.log(`User ${addressShort}: ⏳ Claiming free points...`);
                    const tx = await walletContract.claimFreePoints();
                    console.log(`   -> Tx: ${tx.hash.slice(0,10)}...`);
                    await sleep(2000);
                    continue; // Move to next wallet (one action per round per wallet)
                }

                // DECISION 2: SET PROFILE
                // If username is empty, set one.
                if (!profile.username) {
                    const randomName = NAMES[Math.floor(Math.random() * NAMES.length)] + Math.floor(Math.random() * 100);
                    console.log(`User ${addressShort}: 👤 Setting Profile to '${randomName}'...`);
                    const tx = await walletContract.setProfile(randomName);
                    console.log(`   -> Tx: ${tx.hash.slice(0,10)}...`);
                    await sleep(2000);
                    continue;
                }

                // DECISION 3: STAKE OR TRANSFER
                // If we have points, do something with them.
                if (balance > 0n) {
                    const choice = Math.random();
                    if (choice < 0.5) {
                        // STAKE
                        console.log(`User ${addressShort}: 🥩 Staking ${balance} points...`);
                        const tx = await walletContract.stakePoints(balance);
                        console.log(`   -> Tx: ${tx.hash.slice(0,10)}...`);
                    } else {
                        // TRANSFER (To the next wallet in the list, wrapping around)
                        const nextWallet = wallets[(i + 1) % wallets.length].address;
                        console.log(`User ${addressShort}: 💸 Sending ${balance} points to neighbor...`);
                        const tx = await walletContract.transferPoints(nextWallet, balance);
                        console.log(`   -> Tx: ${tx.hash.slice(0,10)}...`);
                    }
                    await sleep(2000);
                    continue;
                }

                // DECISION 4: UNSTAKE
                // Small chance (20%) to unstake if we have staked tokens
                if (staked > 0n && Math.random() < 0.2) {
                    console.log(`User ${addressShort}: 🔓 Unstaking ${staked} points...`);
                    const tx = await walletContract.unstakePoints(staked);
                    console.log(`   -> Tx: ${tx.hash.slice(0,10)}...`);
                    await sleep(2000);
                    continue;
                }

                console.log(`User ${addressShort}: 💤 No actions available.`);

            } catch (error) {
                 console.log(`   ⚠️ Error for ${addressShort}: ${error.shortMessage || error.code}`);
            }
        }

        console.log(`\nTaking a short nap before next round...`);
        await sleep(5000); // 5 seconds break between rounds
        round++;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});