import React, { RefObject, useState, useEffect } from "react";
import "./StatusBar.css";
import { FaWallet, FaTicketAlt, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import { BiReset } from "react-icons/bi";
import { IoCloseCircle } from "react-icons/io5";

interface StatusBarProps {
  allowedPicks: number;
  usedTickets: number;
  isMuted: boolean;
  toggleMute: () => void;
  playHoverSound: () => void;
  audioRef: RefObject<HTMLAudioElement>;
  walletAddress?: string;
  walletName?: string;
  walletDomain?: string;
  fetchError?: boolean;
  hasProblem?: boolean;
  onResetTickets?: () => void;
  isGameStarted?: boolean;
  isGameEnded?: boolean;
  onForceQuit?: () => void;
  ownedTickets?: number;
  onResetOwnedTickets?: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  allowedPicks,
  usedTickets,
  isMuted,
  toggleMute,
  playHoverSound,
  audioRef: _audioRef,
  walletAddress,
  walletName,
  walletDomain,
  fetchError,
  hasProblem,
  onResetTickets,
  isGameStarted,
  isGameEnded,
  onForceQuit,
  ownedTickets = 0,
  onResetOwnedTickets,
}) => {
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const remaining = allowedPicks - usedTickets;

  let displayName = "Not Connected";
  let isConnected = false;
  
  if (walletName) {
    displayName = walletName;
    isConnected = true;
  } else if (walletDomain) {
    displayName = walletDomain;
    isConnected = true;
  } else if (walletAddress) {
    displayName = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    isConnected = true;
  }

  const isProblematic = hasProblem || fetchError;
  const isGameActive = isGameStarted && !isGameEnded && allowedPicks > 0 && usedTickets < allowedPicks;
  
  // ✅ แก้ไขเงื่อนไข: แสดงเมื่อมีตั๋วที่ซื้อไว้ (ownedTickets > 0) 
  // และยังไม่ได้ใช้ทั้งหมด (usedTickets < ownedTickets) หรือยังไม่ได้เริ่มเกม
  const hasUnusedTickets = ownedTickets > 0 && usedTickets < ownedTickets;

  // ✅ Debug: log ค่าต่างๆ เพื่อตรวจสอบ
  useEffect(() => {
    console.log("🔍 StatusBar Debug:");
    console.log("  ownedTickets:", ownedTickets);
    console.log("  usedTickets:", usedTickets);
    console.log("  hasUnusedTickets:", hasUnusedTickets);
    console.log("  isGameActive:", isGameActive);
    console.log("  allowedPicks:", allowedPicks);
  }, [ownedTickets, usedTickets, hasUnusedTickets, isGameActive, allowedPicks]);

  useEffect(() => {
    if (showQuitConfirm) {
      const timer = setTimeout(() => setShowQuitConfirm(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showQuitConfirm]);

  const handleToggleMute = () => {
    toggleMute();
  };

  const handleResetOwnedTickets = () => {
    if (onResetOwnedTickets) {
      if (window.confirm(`⚠️ You have ${ownedTickets} unused ticket(s)! Reset them to buy new tickets?`)) {
        onResetOwnedTickets();
      }
    }
  };

  const handleForceQuitDirect = () => {
    if (onForceQuit) {
      onForceQuit();
      setShowQuitConfirm(false);
    }
  };

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className="status-item">
          <FaTicketAlt className="status-icon" color={remaining > 0 ? "#ffd700" : "#666"} />
          <span className="status-text">
            {isGameActive ? (
              <>
                <span className="status-number">{usedTickets}</span>
                <span className="status-label"> / </span>
                <span className="status-number">{allowedPicks}</span>
                <span className="status-label"> picks</span>
              </>
            ) : isGameEnded ? (
              <span className="status-ended">✅ Game Ended</span>
            ) : allowedPicks > 0 && usedTickets >= allowedPicks ? (
              <span className="status-ended">✅ Game Ended</span>
            ) : allowedPicks > 0 ? (
              <span className="status-ready">🎮 Ready to play</span>
            ) : (
              <span className="status-waiting">⏳ Buy ticket</span>
            )}
          </span>
        </div>

        {/* ✅ แสดง warning เมื่อมีตั๋วค้าง */}
        {hasUnusedTickets && (
          <div className="status-warning">
            <span className="warning-icon">⚠️</span>
            <span className="warning-text">{ownedTickets - usedTickets} unused ticket(s)</span>
          </div>
        )}
      </div>

      <div className="status-right">
        <div className={`status-wallet ${isConnected ? "connected" : "disconnected"}`}>
          <FaWallet className="status-icon" />
          <span className="wallet-name">{displayName}</span>
          {isConnected && <span className="wallet-dot">●</span>}
        </div>

        <button
          className={`status-btn sound-btn ${isMuted ? "muted" : "unmuted"}`}
          onClick={handleToggleMute}
          onMouseEnter={playHoverSound}
          onTouchStart={playHoverSound}
          title={isMuted ? "🔇 เปิดเสียง" : "🔊 ปิดเสียง"}
        >
          {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
          <span className="sound-label">{isMuted ? "OFF" : "ON"}</span>
        </button>

        {/* ✅ ปุ่ม Reset - แสดงเมื่อมีตั๋วค้าง */}
        {hasUnusedTickets && onResetOwnedTickets && (
          <button
            className="status-btn reset-tickets-btn"
            onClick={handleResetOwnedTickets}
            onMouseEnter={playHoverSound}
            onTouchStart={playHoverSound}
            title="🔄 Reset unused tickets"
          >
            <BiReset />
            <span className="reset-label">Reset</span>
          </button>
        )}

        {isProblematic && onResetTickets && (
          <button
            className="status-btn reset-btn"
            onClick={onResetTickets}
            onMouseEnter={playHoverSound}
            onTouchStart={playHoverSound}
            title="🔄 Reset tickets"
          >
            <BiReset />
          </button>
        )}

        {isGameActive && onForceQuit && (
          <button
            className="status-btn quit-btn"
            onClick={handleForceQuitDirect}
            onMouseEnter={playHoverSound}
            onTouchStart={playHoverSound}
            title="Force quit game"
          >
            <IoCloseCircle />
          </button>
        )}
      </div>
    </div>
  );
};

export default StatusBar;