import ErrorBoundary from "./components/ErrorBoundary.js";
// ✅ เปลี่ยนจาก import React เป็นแบบนี้ (React 17+ ไม่ต้อง import React)
import { useState, useRef, useEffect } from "react";
import "./App.css";

import Header from "./components/Header.js";
import StatusBar from "./components/StatusBar.js";
import CardGrid from "./components/CardGrid.js";
import Footer from "./components/Footer.js";
import ModalManager from "./components/ModalManager.js";
import ErrorBanner from "./components/ErrorBanner.js";
import WalletModal from "./modals/WalletModal.js";

import { useAccount, useWalletClient, usePublicClient, useDisconnect } from "wagmi";
import { switchChain } from "viem/actions";
import { useGameLogic } from "./hooks/useGameLogic.js";
import { playHoverSound, playClickSound } from "./utils/audio.js";

import mangoIcon from "./assets/moon-icon.png";
import logo from "./assets/TogetherWeMoon-logo.png";
import bgMusic from "./assets/JazzduoCard.mp3";
import cardsList from "./assets/cards.js";

import { waitForTransactionReceipt } from "viem/actions";
import { playGameWin, playGameLose, getTicketsInfo } from "./contracts/contract.js";
import { contractAddress, contractAbi } from "./contracts/contract.js";

// ✅ Import ConfirmModal
import ConfirmModal from "./modals/ConfirmModal.js";

function App() {
  // 🔊 Audio
  const [isMuted, setIsMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 📌 Modal states
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showGuardModal, setShowGuardModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showBuyTicket, setShowBuyTicket] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showHowto, setShowHowto] = useState(false);

  // ✅ Confirm Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  // 🪙 Wallet
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(null);
  const { address } = useAccount();
  console.log("[DEBUG] useAccount address:", address);
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  // ✅ ใช้ _ ข้างหน้าเพื่อบอกว่าตั้งใจไม่ใช้
  const { disconnect: _disconnect } = useDisconnect();
  const [profile, setProfileState] = useState<any | null>(null);
  
  useEffect(() => {
    if (profile) {
      console.log("[DEBUG] Profile in App:", profile);
      console.log("[DEBUG] Profile.name:", profile?.name);
      console.log("[DEBUG] Profile.domainName:", profile?.domainName);
    } else {
      console.log("[DEBUG] Profile in App: null");
    }
  }, [profile]);

  // ✅ ฟังก์ชันเปิด Confirm Modal
  const openConfirmModal = (config: {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  }) => {
    setConfirmConfig(config);
    setShowConfirmModal(true);
  };

  // 🎟 Tickets
  const [ticketsOwned, setTicketsOwned] = useState(0);
  const [ownedTickets, setOwnedTickets] = useState(0);
  const ticketBought = ticketsOwned > 0;

  // ⚙️ Game state
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null);

  const effectiveAddress = resolvedAddress || walletAddress || address || null;

  const [pendingAction, setPendingAction] = useState<"refresh" | "disconnect" | "navigate" | null>(null);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initialCards = cardsList;

  // 🎮 Game logic
  const {
    cards,
    flipped,
    matched,
    preMatched,
    resetGame,
    startGame,
    stopGame,
    resumeGame,
    handleFlip,
    buyTickets,
    reward,
    revealedTransparent,
    isGameEnded,
    winningPairs,
    losingCards,
    usedTickets,
    allowedPicks,
    isGameStarted,
    setAllowedPicks,
    setUsedTickets,
    pendingFlip,
    hasProblem,
    forceResetGame,
  } = useGameLogic(initialCards, ticketsOwned, effectiveAddress || undefined);

  const [didWin, setDidWin] = useState(false);

  // ✅ ฟังก์ชัน Reset Owned Tickets
  const handleResetOwnedTickets = async () => {
    if (!walletClient || !publicClient) {
      console.error("[DEBUG] No wallet or public client");
      alert("❌ Please connect wallet first");
      return;
    }

    try {
      console.log("[DEBUG] Resetting owned tickets...");
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: "playGameLose",
        args: [],
      });

      await waitForTransactionReceipt(publicClient, { hash: txHash });
      console.log("[DEBUG] Reset successful");
      
      // ✅ โหลดข้อมูลใหม่
      await fetchTickets();
      
      // ✅ รีเซ็ตเกม
      resetGame(cardsList);
      setShowRewardModal(false);
      
      alert("✅ Tickets reset successfully!");
      
    } catch (err: any) {
      console.error("[DEBUG] Reset failed:", err);
      if (err.message?.includes("User rejected")) {
        alert("❌ Transaction cancelled");
      } else {
        alert("❌ Reset failed. Please try again.");
      }
    }
  };

  // ✅ บังคับออกจากเกม (ใช้ Confirm Modal แทน window.confirm)
  const forceQuitGame = () => {
    openConfirmModal({
      title: "⚠️ Quit Game?",
      message: "Your current ticket will be lost.\nAre you sure you want to quit?",
      onConfirm: () => {
        stopGame();
        resetGame(cardsList);
        setTicketsOwned(0);
        setOwnedTickets(0);
        setAllowedPicks(0);
        setUsedTickets(0);
        setShowRewardModal(false);
        localStorage.removeItem("isGameStarted");
        localStorage.removeItem("isGameEnded");
        console.log("[DEBUG] Force quit game");
      },
      confirmText: "Yes, Quit",
      cancelText: "Cancel",
    });
  };

  // ✅ Exit และ Resume สำหรับ ExitWarningModal
  const handleExitGame = () => {
    stopGame();
    resetGame(cardsList);
    setTicketsOwned(0);
    setOwnedTickets(0);
    setAllowedPicks(0);
    setUsedTickets(0);
    setShowRewardModal(false);
    setShowExitWarning(false);
    localStorage.removeItem("isGameStarted");
    localStorage.removeItem("isGameEnded");
    console.log("[DEBUG] Exit game");
  };

  const handleResumeGame = () => {
    setShowExitWarning(false);
    console.log("[DEBUG] Resume game");
  };

  useEffect(() => {
    async function ensureShidoNetwork() {
      if (walletClient) {
        try {
          await switchChain(walletClient, { id: 9008 });
          console.log("[DEBUG] Switched to Shido Network");
        } catch (err) {
          console.error("[DEBUG] Failed to switch chain:", err);
        }
      }
    }
    ensureShidoNetwork();
  }, [walletClient]);

  useEffect(() => {
    if (address) {
      setWalletAddress(address as `0x${string}`);
    } else {
      setWalletAddress(null);
    }
  }, [address]);

  useEffect(() => {
    const savedGameStarted = localStorage.getItem("isGameStarted");
    if (savedGameStarted && JSON.parse(savedGameStarted)) {
      fetchTickets();
      setShowAnnouncement(false);
      console.log("[DEBUG] Auto-fetch tickets after refresh");
    } else {
      setShowAnnouncement(true);
      console.log("[DEBUG] First visit → show AnnouncementModal");
    }
  }, []);

  useEffect(() => {
    if (address) {
      setWalletAddress(address as `0x${string}`);
      console.log("[DEBUG] Wallet address set:", address);
    } else {
      setWalletAddress(null);
      console.log("[DEBUG] Wallet disconnected");
      setShowRewardModal(false);
    }
  }, [address]);
  

  useEffect(() => {
    cardsList.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    console.log("[DEBUG] Preloaded card images");
  }, []);

  const [fetchError, setFetchError] = useState(false);

  const fetchTickets = async (retry = 3) => {
    if (walletClient && publicClient && effectiveAddress) {
      try {
        console.log("[DEBUG] Fetching tickets from contract...");
        const { owned, used } = await getTicketsInfo(publicClient, effectiveAddress as `0x${string}`);

        // ✅ อัปเดต ownedTickets ด้วย
        setOwnedTickets(owned);
        setTicketsOwned(owned);
        setAllowedPicks(owned);
        setUsedTickets(used);

        localStorage.setItem("ticketsOwned", owned.toString());
        localStorage.setItem("ticketsUsed", used.toString());

        // ✅ เรียก resumeGame เพื่อ restore state
        resumeGame();
        console.log("[DEBUG] Resume game triggered after fetchTickets");
        
      } catch (err) {
        console.error("[DEBUG] Fetch tickets failed:", err);
        setFetchError(true);
        if (retry > 0) setTimeout(() => fetchTickets(retry - 1), 5000);
      }
    }
  };

  useEffect(() => {
    const savedTx = localStorage.getItem("lastTxHash");
    if (savedTx && publicClient) {
      (async () => {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: savedTx as `0x${string}` });
          if (receipt?.status === "success") {
            await fetchTickets();
            localStorage.removeItem("lastTxHash");
          } else {
            resetGame(cardsList);
            setTicketsOwned(0);
            setOwnedTickets(0);
            setAllowedPicks(0);
            setUsedTickets(0);
            localStorage.removeItem("lastTxHash");
          }
        } catch (err) {
          resetGame(cardsList);
          setTicketsOwned(0);
          setOwnedTickets(0);
          setAllowedPicks(0);
          setUsedTickets(0);
          localStorage.removeItem("lastTxHash");
        }
      })();
    }
  }, [publicClient]);

  useEffect(() => {
    fetchTickets();
  }, [walletClient, publicClient, address]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isGameStarted && !isGameEnded) {
        e.preventDefault();
        e.returnValue = "⚠️ Warning: Your ticket will be lost if the game is unfinished.";
        setShowExitWarning(true);
        setTimeout(() => setShowExitWarning(false), 3000);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isGameStarted, isGameEnded]);

  useEffect(() => {
    if (!address && isGameStarted && !isGameEnded) {
      setErrorMessage("⚠️ Wallet disconnected while the game is still in progress");
      setPendingAction("disconnect");
      setTimeout(() => {
        setErrorMessage(null);
        setPendingAction(null);
      }, 3000);
    }
  }, [address, isGameStarted, isGameEnded]);

  return (
    <ErrorBoundary>
      <div className="viewport">
        {/* ✅ เพิ่ม audio element สำหรับ BG Music */}
        <audio ref={audioRef} src={bgMusic} loop preload="auto" />

        <Header
          logo={logo}
          setShowAnnouncement={setShowAnnouncement}
          playHoverSound={playHoverSound}
          stopGame={stopGame}
        />
        

        {showWalletModal && (
          <WalletModal
            setShowWallet={setShowWalletModal}
            showWalletModal={showWalletModal}
            onConnected={(addr: `0x${string}` | null) => {
              if (addr) setWalletAddress(addr);
            }}
            setProfile={(p: any) => {
              setProfileState(p);
            }}
            walletAddress={walletAddress || undefined}
          />
        )}

        <StatusBar
          allowedPicks={allowedPicks}
          usedTickets={usedTickets}
          isMuted={isMuted}
          toggleMute={() => {
            if (audioRef.current) {
              audioRef.current.muted = !audioRef.current.muted;
              setIsMuted(audioRef.current.muted);
            }
          }}
          playHoverSound={playHoverSound}
          audioRef={audioRef}
          walletAddress={effectiveAddress || undefined}
          walletName={profile?.name}
          walletDomain={profile?.domainName}
          fetchError={fetchError}
          hasProblem={hasProblem}
          onResetTickets={() => {
            if (walletClient && publicClient) {
              forceResetGame(walletClient, publicClient, initialCards);
            }
          }}
          isGameStarted={isGameStarted}
          isGameEnded={isGameEnded}
          onForceQuit={forceQuitGame}
          ownedTickets={ownedTickets}
          onResetOwnedTickets={handleResetOwnedTickets}
        />
        

        <ErrorBanner
          errorMessage={errorMessage}
          pendingAction={pendingAction}
          showExitWarning={showExitWarning}
          onCancelNavigation={() => setPendingAction(null)}
          onClose={() => {
            setErrorMessage(null);
            setPendingAction(null);
            setShowExitWarning(false);
          }}
        />


        <CardGrid
          cards={cards}
          flipped={flipped}
          matched={matched}
          preMatched={preMatched}
          revealedTransparent={revealedTransparent}
          mangoIcon={mangoIcon}
          winningPairs={winningPairs}
          losingCards={losingCards}
          pendingFlip={pendingFlip}
          didWin={didWin}
          handleFlip={async (index: number) => {
            if (!walletAddress) {
              console.log("[DEBUG] Cannot flip, wallet disconnected");
              return;
            }

            console.log("[DEBUG] Flip card index:", index, "Allowed picks:", allowedPicks, "Used tickets:", usedTickets);

            if (walletClient && publicClient) {
              handleFlip(
                index,
                "Player1",
                async (didWinResult: boolean) => {
                  setDidWin(didWinResult);
                  stopGame();

                  let cancelCount = 0;

                  const sendTx = async () => {
                    try {
                      let txHash: `0x${string}`;

                      if (didWinResult) {
                        const rewardAmount = BigInt(20000) * BigInt(10 ** 18);
                        txHash = await playGameWin(walletClient, publicClient, rewardAmount);
                      } else {
                        txHash = await playGameLose(walletClient, publicClient);
                      }

                      localStorage.setItem("lastTxHash", txHash);
                      console.log("[DEBUG] Tx sent:", txHash);

                      await waitForTransactionReceipt(publicClient, { hash: txHash });
                      localStorage.removeItem("lastTxHash");

                      await fetchTickets();

                      // ✅ เปิด Reward Modal
                      setTimeout(() => {
                        setShowRewardModal(true);
                      }, 3000);

                    } catch (err: any) {
                      console.error("[DEBUG] playGame tx failed:", err);

                      if (err.message?.includes("User rejected")) {
                        cancelCount++;
                        console.log(`[DEBUG] User cancelled transaction (count=${cancelCount})`);

                        if (cancelCount < 5) {
                          console.log("[DEBUG] Retrying transaction...");
                          await sendTx();
                        } else {
                          console.log("[DEBUG] User cancelled 5 times, ending game and resetting.");
                          setShowRewardModal(false);
                          stopGame();
                          resetGame(cardsList);
                          setTicketsOwned(0);
                          setOwnedTickets(0);
                          setAllowedPicks(0);
                          setUsedTickets(0);
                        }
                      }
                    }
                  };

                  await sendTx();
                },
                walletClient,
                publicClient,
                BigInt(20000) * BigInt(10 ** 18)
              );
            } else {
              console.error("[ERROR] walletClient or publicClient is undefined");
            }
          }}
        />

        <ModalManager
          showAnnouncement={showAnnouncement}
          setShowAnnouncement={setShowAnnouncement}
          showGuardModal={showGuardModal}
          setShowGuardModal={setShowGuardModal}
          showRewardModal={showRewardModal}
          setShowRewardModal={setShowRewardModal}
          showWalletModal={showWalletModal}
          setShowWalletModal={setShowWalletModal}
          showBuyTicket={showBuyTicket}
          setShowBuyTicket={setShowBuyTicket}
          showExitWarning={showExitWarning}
          setShowExitWarning={setShowExitWarning}
          showHowto={showHowto}
          setShowHowto={setShowHowto}
          showAdmin={showAdmin}
          setShowAdmin={setShowAdmin}
          audioRef={audioRef}
          setIsMuted={setIsMuted}
          playClickSound={playClickSound}
          playHoverSound={playHoverSound}
          reward={reward}
          walletAddress={effectiveAddress}
          walletClient={walletClient ?? undefined}
          publicClient={publicClient ?? undefined}
          userAddress={effectiveAddress ?? address ?? undefined}
          resetGame={() => resetGame(cardsList)}
          buyTickets={buyTickets}
          startGame={startGame}
          ticketsOwned={ticketsOwned}
          setTicketsOwned={setTicketsOwned}
          setResolvedAddress={setResolvedAddress}
          setWalletAddress={setWalletAddress}
          setAllowedPicks={setAllowedPicks}
          setUsedTickets={setUsedTickets}
          onExit={handleExitGame}
          onResume={handleResumeGame}
        />
        
        
        <Footer
          buyTickets={buyTickets}
          startGame={startGame}
          isGameEnded={isGameEnded}
          ticketBought={ticketBought} 
          setTicketBought={() => { }}
          walletClient={walletClient ?? undefined}
          publicClient={publicClient ?? undefined}
          ticketsOwned={ticketsOwned}
          setTicketsOwned={setTicketsOwned}
        />

        {/* ✅ Confirm Modal สำหรับยืนยันการกระทำ */}
        <ConfirmModal
          isOpen={showConfirmModal}
          title={confirmConfig?.title || "Confirm"}
          message={confirmConfig?.message || "Are you sure?"}
          onConfirm={() => {
            if (confirmConfig?.onConfirm) {
              confirmConfig.onConfirm();
            }
            setShowConfirmModal(false);
            setConfirmConfig(null);
          }}
          onCancel={() => {
            setShowConfirmModal(false);
            setConfirmConfig(null);
          }}
          confirmText={confirmConfig?.confirmText || "Confirm"}
          cancelText={confirmConfig?.cancelText || "Cancel"}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;