import { useState, useEffect, useRef } from "react";
import { getRandomCards } from "../utils/cards.js";
import { playGameLose, getTicketsInfo } from "../contracts/contract.js";
import type { WalletClient, PublicClient } from "viem";

type TicketOption = {
  cards: number;
  price: number;
};

export function useGameLogic(
  initialCards: string[],
  ticketsOwnedFromContract: number,
  walletAddress?: `0x${string}`
) {
  const [cards, setCards] = useState<string[]>(() => {
    const savedCards = localStorage.getItem("cards");
    const parsed = savedCards ? JSON.parse(savedCards) : [];
    if (Array.isArray(parsed) && parsed.length === 20) {
      return parsed;
    } else {
      const newCards = getRandomCards(initialCards, 10);
      localStorage.setItem("cards", JSON.stringify(newCards));
      return newCards;
    }
  });

  const [flipped, setFlipped] = useState<number[]>(() => {
    const saved = localStorage.getItem("flipped");
    return saved ? JSON.parse(saved) : [];
  });
  const [matched, setMatched] = useState<number[]>(() => {
    const saved = localStorage.getItem("matched");
    return saved ? JSON.parse(saved) : [];
  });
  const [isChecking, setIsChecking] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(() => {
    const saved = localStorage.getItem("isGameStarted");
    return saved ? JSON.parse(saved) : false;
  });
  const [isGameEnded, setIsGameEnded] = useState(() => {
    const saved = localStorage.getItem("isGameEnded");
    return saved ? JSON.parse(saved) : false;
  });
  const [usedTickets, setUsedTickets] = useState(() => {
    const savedUsed = localStorage.getItem("usedTickets");
    return savedUsed ? Number(savedUsed) : 0;
  });
  const [lastPurchase, setLastPurchase] = useState<TicketOption | null>(null);
  const [reward, setReward] = useState<boolean | null>(null);
  const [revealedTransparent, setRevealedTransparent] = useState<number[]>(() => {
    const saved = localStorage.getItem("revealedTransparent");
    return saved ? JSON.parse(saved) : [];
  });
  const [winningPairs, setWinningPairs] = useState<number[]>(() => {
    const saved = localStorage.getItem("winningPairs");
    return saved ? JSON.parse(saved) : [];
  });
  const [losingCards, setLosingCards] = useState<number[]>(() => {
    const saved = localStorage.getItem("losingCards");
    return saved ? JSON.parse(saved) : [];
  });
  const [allowedPicks, setAllowedPicks] = useState(() => {
    const savedAllowed = localStorage.getItem("allowedPicks");
    return savedAllowed ? Number(savedAllowed) : 0;
  });
  const [hasProblem, setHasProblem] = useState(false);
  const [preMatched, setPreMatched] = useState<number[]>([]);
  const [pendingFlip, setPendingFlip] = useState<number | null>(null);

  // ✅ ตัวแปรควบคุมการแสดงผล
  const [showResult, setShowResult] = useState(() => {
    const saved = localStorage.getItem("showResult");
    return saved ? JSON.parse(saved) : false;
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ticketOptions: TicketOption[] = [
    { cards: 2, price: 1500 },
    { cards: 3, price: 4000 },
    { cards: 4, price: 7500 },
    { cards: 5, price: 12000 },
  ];

  // ✅ บันทึก state ทุกครั้งที่เปลี่ยน
  useEffect(() => {
    try {
      localStorage.setItem("cards", JSON.stringify(cards));
      localStorage.setItem("flipped", JSON.stringify(flipped));
      localStorage.setItem("matched", JSON.stringify(matched));
      localStorage.setItem("revealedTransparent", JSON.stringify(revealedTransparent));
      localStorage.setItem("usedTickets", usedTickets.toString());
      localStorage.setItem("allowedPicks", allowedPicks.toString());
      localStorage.setItem("isGameStarted", JSON.stringify(isGameStarted));
      localStorage.setItem("isGameEnded", JSON.stringify(isGameEnded));
      localStorage.setItem("winningPairs", JSON.stringify(winningPairs));
      localStorage.setItem("losingCards", JSON.stringify(losingCards));
      localStorage.setItem("showResult", JSON.stringify(showResult));
    } catch (err) {
      console.error("[DEBUG] Failed to save localStorage:", err);
    }
  }, [cards, flipped, matched, revealedTransparent, usedTickets, allowedPicks, isGameStarted, isGameEnded, winningPairs, losingCards, showResult]);

  // ✅ Cleanup timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
    };
  }, []);

  function buyTickets(cardsCount: number) {
    const option = ticketOptions.find(opt => opt.cards === cardsCount);
    if (!option) return;

    // ✅ เคลียร์ทุกอย่าง
    setFlipped([]);
    setMatched([]);
    setRevealedTransparent([]);
    setWinningPairs([]);
    setLosingCards([]);
    setPendingFlip(null);
    setReward(null);
    setShowResult(false);
    setIsGameEnded(false);
    setAllowedPicks(cardsCount);
    setUsedTickets(0);
    setLastPurchase(option);
    setIsGameStarted(true);
    
    localStorage.setItem("usedTickets", "0");
    localStorage.setItem("flipped", "[]");
    localStorage.setItem("matched", "[]");
    localStorage.setItem("revealedTransparent", "[]");
    localStorage.setItem("winningPairs", "[]");
    localStorage.setItem("losingCards", "[]");
    localStorage.setItem("showResult", "false");
    localStorage.setItem("isGameEnded", "false");
    localStorage.setItem("isGameStarted", "true");

    console.log("[DEBUG] buyTickets reset everything, allowedPicks:", cardsCount);
  }

  function handleFlip(
    index: number,
    _playerName: string,
    onGameEnd: (reward: boolean) => void,
    _walletClient: WalletClient,
    _publicClient: PublicClient,
    _rewardAmount: bigint
  ) {
    // ✅ เช็คเงื่อนไข
    if (!isGameStarted || isGameEnded || isChecking) return;
    if (allowedPicks <= 0) return;
    if (flipped.includes(index) || matched.includes(index)) return;
    if (usedTickets >= allowedPicks) return;

    // ✅ Clear old timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }

    const newUsedTickets = usedTickets + 1;
    let newFlipped = [...flipped];

    // ✅ ใบสุดท้าย → เก็บไว้ก่อน (ไม่หงาย)
    if (newUsedTickets < allowedPicks) {
      newFlipped = [...flipped, index];
      setFlipped(newFlipped);
      localStorage.setItem("flipped", JSON.stringify(newFlipped));
    } else {
      // ✅ ใบสุดท้าย → คว่ำค้างไว้ (pendingFlip)
      setPendingFlip(index);
    }

    setUsedTickets(newUsedTickets);
    localStorage.setItem("usedTickets", newUsedTickets.toString());
    localStorage.setItem("isGameStarted", "true");
    localStorage.setItem("isGameEnded", "false");

    setIsChecking(true);

    // ✅ ถ้ายังไม่ครบ → รอเลือกต่อ
    if (newUsedTickets < allowedPicks) {
      setIsChecking(false);
      return;
    }

    // ✅ เลือกครบแล้ว → เริ่มตรวจสอบ
    const finalIndex = index;

    // ✅ ขั้นตอนที่ 1: รอ 0.5 วินาที แล้วหงายใบสุดท้าย
    timeoutRef.current = setTimeout(() => {
      // ✅ หงายใบสุดท้าย (เพิ่มเข้า flipped)
      const finalFlipped = [...newFlipped, finalIndex];
      setFlipped(finalFlipped);
      setPendingFlip(null);
      localStorage.setItem("flipped", JSON.stringify(finalFlipped));

      // ✅ ขั้นตอนที่ 2: ตรวจสอบผล
      const allIndices = cards.map((_, i) => i);
      const notSelected = allIndices.filter(i => !finalFlipped.includes(i));

      // ✅ หาคู่ที่จับคู่ได้
      const pairIndices = finalFlipped.filter((i, _, arr) =>
        arr.some(j => j !== i && cards[j] === cards[i])
      );
      const hasPair = pairIndices.length > 0;

      let didWin = false;
      let winIndices: number[] = [];
      let loseIndices: number[] = [];

      if (hasPair) {
        // ✅ ชนะ
        didWin = true;
        winIndices = pairIndices;
        loseIndices = finalFlipped.filter(i => !pairIndices.includes(i));
      } else {
        // ❌ แพ้
        didWin = false;
        winIndices = [];
        loseIndices = finalFlipped;
      }

      // ✅ ตั้งค่า state
      setMatched(finalFlipped);
      setWinningPairs(winIndices);
      setLosingCards(loseIndices);
      setRevealedTransparent(notSelected);
      setReward(didWin);

      localStorage.setItem("matched", JSON.stringify(finalFlipped));
      localStorage.setItem("winningPairs", JSON.stringify(winIndices));
      localStorage.setItem("losingCards", JSON.stringify(loseIndices));
      localStorage.setItem("revealedTransparent", JSON.stringify(notSelected));

      // ✅ ขั้นตอนที่ 3: รอ 1.5 วินาที แล้วค่อยแสดงกรอบสี
      resultTimeoutRef.current = setTimeout(() => {
        setShowResult(true);
        setIsGameEnded(true);
        setIsChecking(false);
        stopGame();
        onGameEnd(didWin);

        localStorage.setItem("showResult", "true");
        localStorage.setItem("isGameEnded", "true");

        console.log("[DEBUG] Game ended, result:", didWin ? "WIN" : "LOSE");
        console.log("[DEBUG] winningPairs:", winIndices);
        console.log("[DEBUG] losingCards:", loseIndices);
        console.log("[DEBUG] revealedTransparent:", notSelected);
      }, 1500);

      timeoutRef.current = null;
    }, 500);
  }

  function resetGame(initialCards: string[]) {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }

    const newCards = getRandomCards(initialCards, 10);
    if (newCards.length !== 20) {
      console.error("[ERROR] getRandomCards returned invalid length:", newCards.length);
    }

    localStorage.clear();
    localStorage.setItem("cards", JSON.stringify(newCards));

    setCards(newCards);
    setFlipped([]);
    setMatched([]);
    setRevealedTransparent([]);
    setWinningPairs([]);
    setLosingCards([]);
    setPendingFlip(null);
    setReward(null);
    setShowResult(false);
    setIsGameStarted(false);
    setIsGameEnded(false);
    setUsedTickets(0);
    setAllowedPicks(0);
    setLastPurchase(null);
    setIsChecking(false);

    localStorage.setItem("flipped", "[]");
    localStorage.setItem("matched", "[]");
    localStorage.setItem("revealedTransparent", "[]");
    localStorage.setItem("winningPairs", "[]");
    localStorage.setItem("losingCards", "[]");
    localStorage.setItem("showResult", "false");
    localStorage.setItem("usedTickets", "0");
    localStorage.setItem("allowedPicks", "0");
    localStorage.setItem("isGameStarted", "false");
    localStorage.setItem("isGameEnded", "false");

    console.log("[DEBUG] resetGame completed");
  }

  function startGame() {
    setIsGameStarted(true);
    setIsGameEnded(false);
    setReward(null);
    setShowResult(false);
    localStorage.setItem("isGameStarted", "true");
    localStorage.setItem("isGameEnded", "false");
  }

  function stopGame() {
    setIsGameStarted(false);
    localStorage.setItem("isGameStarted", "false");
  }

  function resumeGame() {
    const savedCards = localStorage.getItem("cards");
    const parsedCards = savedCards ? JSON.parse(savedCards) : [];
    if (!Array.isArray(parsedCards) || parsedCards.length !== 20) {
      const newCards = getRandomCards(initialCards, 10);
      setCards(newCards);
      localStorage.setItem("cards", JSON.stringify(newCards));
    } else {
      setCards(parsedCards);
    }

    // ✅ ดึงข้อมูลทั้งหมดจาก localStorage
    const savedAllowedPicks = localStorage.getItem("allowedPicks");
    const savedUsedTickets = localStorage.getItem("usedTickets");
    const savedGameEnded = localStorage.getItem("isGameEnded");
    const savedFlipped = localStorage.getItem("flipped");
    const savedMatched = localStorage.getItem("matched");
    const savedRevealedTransparent = localStorage.getItem("revealedTransparent");
    const savedWinningPairs = localStorage.getItem("winningPairs");
    const savedLosingCards = localStorage.getItem("losingCards");
    const savedShowResult = localStorage.getItem("showResult");

    // ✅ Restore flipped, matched, revealedTransparent
    const flippedData = savedFlipped ? JSON.parse(savedFlipped) : [];
    const matchedData = savedMatched ? JSON.parse(savedMatched) : [];
    const transparentData = savedRevealedTransparent ? JSON.parse(savedRevealedTransparent) : [];
    const winningPairsData = savedWinningPairs ? JSON.parse(savedWinningPairs) : [];
    const losingCardsData = savedLosingCards ? JSON.parse(savedLosingCards) : [];
    const showResultData = savedShowResult ? JSON.parse(savedShowResult) : false;

    setFlipped(flippedData);
    setMatched(matchedData);
    setRevealedTransparent(transparentData);
    setWinningPairs(winningPairsData);
    setLosingCards(losingCardsData);
    setShowResult(showResultData);

    if (ticketsOwnedFromContract === 0 && usedTickets === 0 && savedAllowedPicks === null) {
      setAllowedPicks(0);
      setUsedTickets(0);
      setIsGameStarted(false);
      setIsGameEnded(false);
      return;
    }

    const allowed = savedAllowedPicks ? Number(savedAllowedPicks) : 0;
    const used = savedUsedTickets ? Number(savedUsedTickets) : 0;
    const ended = savedGameEnded ? JSON.parse(savedGameEnded) : false;

    // ✅ ถ้ามีตั๋วใน contract หรือมีข้อมูลใน localStorage
    if (allowed > 0) {
      setAllowedPicks(allowed);
      setUsedTickets(used);
      
      if (!ended && used < allowed) {
        setIsGameStarted(true);
        setIsGameEnded(false);
        console.log("[DEBUG] Game resumed with flipped:", flippedData.length, "picks used:", used, "of", allowed);
      } else if (ended) {
        setIsGameEnded(true);
        setIsGameStarted(false);
        console.log("[DEBUG] Game already ended");
      } else if (used >= allowed) {
        setIsGameEnded(true);
        setIsGameStarted(false);
        setShowResult(true);
        console.log("[DEBUG] All picks used, game should end");
      }
    } else if (ticketsOwnedFromContract > 0) {
      // ✅ มีตั๋วจาก contract
      setAllowedPicks(ticketsOwnedFromContract);
      setUsedTickets(0);
      setFlipped([]);
      setMatched([]);
      setRevealedTransparent([]);
      setWinningPairs([]);
      setLosingCards([]);
      setShowResult(false);
      localStorage.setItem("usedTickets", "0");
      localStorage.setItem("flipped", "[]");
      localStorage.setItem("matched", "[]");
      localStorage.setItem("revealedTransparent", "[]");
      localStorage.setItem("winningPairs", "[]");
      localStorage.setItem("losingCards", "[]");
      localStorage.setItem("showResult", "false");
      setIsGameStarted(true);
      setIsGameEnded(false);
    }
  }

  function revealAllCards(flippedIndices: number[]) {
    const allRevealed = Array.from(new Set([...matched, ...flippedIndices]));
    setMatched(allRevealed);
    setRevealedTransparent(
      cards.map((_, i) => i).filter(i => !flipped.includes(i) && !allRevealed.includes(i))
    );
  }

  async function forceResetGame(
    walletClient: WalletClient,
    publicClient: PublicClient,
    initialCards: string[]
  ) {
    try {
      await playGameLose(walletClient, publicClient);
      if (walletAddress) {
        const { owned, used, problematic } = await getTicketsInfo(publicClient, walletAddress);
        setAllowedPicks(owned);
        setUsedTickets(used);
        setHasProblem(problematic);
      }
      resetGame(initialCards);
    } catch (err) {
      console.error("[ERROR] forceResetGame failed:", err);
      throw err;
    }
  }

  async function syncTickets(publicClient: PublicClient) {
    if (!walletAddress) return;
    try {
      const { owned, used, problematic } = await getTicketsInfo(publicClient, walletAddress);
      setAllowedPicks(owned);
      setUsedTickets(used);
      setHasProblem(problematic);
    } catch (err) {
      console.error("[ERROR] syncTickets failed:", err);
    }
  }

  return {
    cards,
    flipped,
    setFlipped,
    matched,
    isGameStarted,
    isGameEnded,
    ticketsOwnedFromContract,
    usedTickets,
    lastPurchase,
    reward,
    revealedTransparent,
    setRevealedTransparent,
    winningPairs,
    losingCards,
    buyTickets,
    handleFlip,
    resetGame,
    startGame,
    stopGame,
    resumeGame,
    allowedPicks,
    setAllowedPicks,
    setUsedTickets,
    forceResetGame,
    revealAllCards,
    pendingFlip,
    hasProblem,
    syncTickets,
    setWinningPairs,
    setMatched,
    setLosingCards,
    preMatched,
    setPreMatched,
    showResult,
  };
}