import { readContract, writeContract } from "viem/actions";
import type { WalletClient, PublicClient } from "viem";
import contractAbi from "./ABI.json"; // ✅ pure ABI array

// ✅ กำหนด type ให้ตรงกับ viem (0x${string})
export const contractAddress: `0x${string}` = "0xF36dfDe806E7476E6426f426d9391044b83F7496";
export { contractAbi }; // ✅ export ออกมา

// ✅ buyTicket
export async function buyTicket(
  walletClient: WalletClient,
  publicClient: PublicClient,
  ticketNumber: number
) {
  const price = await readContract(publicClient, {
    address: contractAddress,
    abi: contractAbi,
    functionName: "getTicketPrice",
    args: [ticketNumber],
  }) as bigint;

  const txHash = await writeContract(walletClient, {
    address: contractAddress,
    abi: contractAbi,
    functionName: "buyTicket",
    args: [ticketNumber],
    value: price,
    chain: walletClient.chain,
    account: walletClient.account ?? null,
  });

  return txHash; // ✅ return txHash (string)
}

// ✅ playGameWin (ชนะ → โอนรางวัล และ reset tickets เป็น 0/0)
export async function playGameWin(
  walletClient: WalletClient,
  publicClient: PublicClient,
  rewardAmount: bigint
) {
  const txHash = await writeContract(walletClient, {
    address: contractAddress,
    abi: contractAbi,
    functionName: "playGameWin",
    args: [rewardAmount],
    chain: walletClient.chain,
    account: walletClient.account ?? null,
  });

  return txHash;
}

// ✅ playGameLose (แพ้ → reset tickets เป็น 0/0 แต่ไม่โอนรางวัล)
export async function playGameLose(
  walletClient: WalletClient,
  publicClient: PublicClient
) {
  const txHash = await writeContract(walletClient, {
    address: contractAddress,
    abi: contractAbi,
    functionName: "playGameLose",
    args: [],
    chain: walletClient.chain,
    account: walletClient.account ?? null,
  });

  return txHash;
}

// ✅ getTicketsInfo (ตรวจสอบตั๋ว)
export async function getTicketsInfo(
  publicClient: PublicClient,
  playerAddress: `0x${string}`
) {
  const [owned, used, problematic] = await readContract(publicClient, {
    address: contractAddress,
    abi: contractAbi,
    functionName: "getTicketsInfo",
    args: [playerAddress],
  }) as [bigint, bigint, boolean]; // ✅ เพิ่ม boolean problematic

  return {
    owned: Number(owned),
    used: Number(used),
    problematic // ✅ คืนค่าเพิ่ม
  };
}


// ✅ getPoolBalance (ดูยอดรวมใน Pool)
export async function getPoolBalance(publicClient: PublicClient) {
  const balance = await readContract(publicClient, {
    address: contractAddress,
    abi: contractAbi,
    functionName: "getPoolBalance",
    args: [],
  }) as bigint;

  return Number(balance);
}
