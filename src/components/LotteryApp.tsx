"use client";

import React, { useState, useEffect, useActionState, useRef, startTransition } from "react";
import { fetchLotteryData, ActionState } from "@/actions/fetchCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Loader2, Sparkles, MapPin, History, RefreshCw, Download, Moon, Star } from "lucide-react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";

const initialState: ActionState = {
  success: false,
};

// Colors for the wheel wedges
const wheelColors = [
  "#DB2777", // pink-600
  "#9333EA", // purple-600
  "#4F46E5", // indigo-600
  "#2563EB", // blue-600
  "#0891B2", // cyan-600
  "#059669", // emerald-600
  "#D97706", // amber-600
  "#DC2626", // red-600
  "#BE185D", // pink-700
  "#6D28D9", // purple-700
  "#4338CA", // indigo-700
  "#1D4ED8", // blue-700
];

export function LotteryApp() {
  const [state, formAction, isPending] = useActionState(fetchLotteryData, initialState);

  const [lotteryData, setLotteryData] = useState<any[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<any | null>(null);
  
  const [rotation, setRotation] = useState(0);
  const [prizeHistory, setPrizeHistory] = useState<any[]>([]);

  const [activeToken, setActiveToken] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [tickerName, setTickerName] = useState("");
  const [bgStars, setBgStars] = useState<any[]>([]);

  useEffect(() => {
    // Generate star positions only on client to avoid hydration mismatch
    const generated = Array.from({ length: 40 }).map(() => ({
      size: Math.random() * 3 + 1,
      left: Math.random() * 100,
      duration: Math.random() * 20 + 10,
      delay: -(Math.random() * 30),
      opacity: Math.random() * 0.5 + 0.1
    }));
    setBgStars(generated);
  }, []);

  const availableData = lotteryData.filter((item) => {
     return !prizeHistory.some(w => 
        (w._uid && item._uid && w._uid === item._uid) || 
        (!w._uid && JSON.stringify(w) === JSON.stringify(item))
     );
  });

  // Initialize data from API
  useEffect(() => {
    if (state.success && state.data && state.data.length > 0) {
      const enriched = state.data.map((d: any) => d._uid ? d : { ...d, _uid: Math.random().toString(36).substring(2, 9) });
      setLotteryData(enriched);
      sessionStorage.setItem("lotteryData", JSON.stringify(enriched));
    }
  }, [state]);

  // Load history from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("lotteryWinners");
    if (saved) {
      try {
        setPrizeHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history.");
      }
    }
    const savedData = sessionStorage.getItem("lotteryData");
    if (savedData) {
       try { setLotteryData(JSON.parse(savedData)); } catch(e) {}
    }
    const savedToken = sessionStorage.getItem("lotteryToken");
    if (savedToken) {
       setActiveToken(savedToken);
       setTempToken(savedToken);
    }
  }, []);

  // Save to history when a new winner is found
  const addToHistory = (winObj: any) => {
    const newHistory = [winObj, ...prizeHistory];
    setPrizeHistory(newHistory);
    sessionStorage.setItem("lotteryWinners", JSON.stringify(newHistory));
  };

  const exportWinners = () => {
    if (prizeHistory.length === 0) return;

    const allKeys = new Set<string>();
    prizeHistory.forEach(winner => {
      Object.keys(winner).forEach(k => {
        if (k !== '_uid') allKeys.add(k);
      });
    });
    const headers = Array.from(allKeys);

    let csv = headers.map(h => `"${h}"`).join(",") + "\n";
    
    prizeHistory.forEach(winner => {
      const row = headers.map(h => {
        let val = winner[h] ?? "";
        if (typeof val === 'object') val = JSON.stringify(val);
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csv += row.join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel UTF-8
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `phitron-winners-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startSpin = () => {
    if (availableData.length === 0 || isSpinning) return;
    setIsSpinning(true);
    setWinner(null);

    // Number of selections
    const numItems = availableData.length;
    // Pick winner
    const winIndex = Math.floor(Math.random() * numItems);
    
    // Calculate angles
    const sliceAngle = 360 / numItems;
    const randomOffsetInsideSlice = Math.random() * sliceAngle * 0.6 + sliceAngle * 0.2; // Don't stop exactly on line
    
    // Calculate final rotation
    // We want the WINNING SLICE to end up pointing UP (270 degrees in standard circle, but depends on our drawing)
    // Our drawing starts slice 0 at -90 degrees (top).
    // The center of slice `i` is at `sliceAngle * i + sliceAngle / 2`.
    // So to bring slice `winIndex` to the top (0 degrees of the component's unrotated state), 
    // we need to rotate backwards by its center angle.
    const targetAngle = -(winIndex * sliceAngle + randomOffsetInsideSlice);
    
    // Add multiple full spins
    const extraSpins = 5 * 360; 
    
    // Find next absolute rotation that satisfies target relative to current
    const currentRotMod = rotation % 360;
    let targetAbsRot = rotation - currentRotMod + targetAngle - extraSpins;
    
    // Guarantee minimum spin amount
    if (Math.abs(targetAbsRot - rotation) < 360 * 3) {
      targetAbsRot -= 360;
    }

    setRotation(targetAbsRot);
    
    // Wait for the CSS transition to end (4 seconds)
    setTimeout(() => {
      setIsSpinning(false);
      setWinner(availableData[winIndex]);
      addToHistory(availableData[winIndex]);
      triggerConfetti();
    }, 4500);
  };

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti(
        Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        })
      );
      confetti(
        Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        })
      );
    }, 250);
  };

  const getDisplayName = (item: any) => {
    if (!item) return "";
    let name = item.name || item.firstName || item.username || item.fullName || item.title || item.id || item._id;
    if (typeof item === 'string') return item;
    return name || "Unknown Participant";
  };

  useEffect(() => {
    let interval: any;
    if (isSpinning) {
      interval = setInterval(() => {
        if (availableData.length > 0) {
          const randomItem = availableData[Math.floor(Math.random() * availableData.length)];
          setTickerName(getDisplayName(randomItem));
        }
      }, 70); // Fast interval for suspense
    } else {
      setTickerName("");
    }
    return () => clearInterval(interval);
  }, [isSpinning, availableData]);
  
  const getSecondaryLabel = (item: any) => {
    if (!item || typeof item === 'string') return "";
    return item.email || item.phone || item.identifier || item.position || "";
  };

  // Helper function to draw an SVG Path Arc
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    // When there's only 1 item, it's a full circle, SVG arcs can't do 360 cleanly
    if (Math.abs(endAngle - startAngle) >= 359.9) {
      return `M ${x} ${y - radius} A ${radius} ${radius} 0 1 1 ${x - 0.1} ${y - radius} Z`;
    }
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", x, y,
      "L", start.x, start.y, 
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "L", x, y,
      "Z"
    ].join(" ");
  };

  const numSlices = availableData.length > 0 ? availableData.length : 1;
  const sliceAngle = 360 / numSlices;
  const cx = 200;
  const cy = 200;
  const radius = 190;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 text-white relative overflow-hidden bg-[#040813]">
      {/* Eid Vibe Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        {/* Soft radial gradients for a magical night sky feel */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-900/20 rounded-full blur-[120px]"></div>
        
        {/* Giant subtle crescent moon */}
        <div className="absolute top-[5%] right-[5%] opacity-40 rotate-12 text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]">
           <Moon className="w-80 h-80" strokeWidth={0.5} fill="currentColor" />
        </div>

        {/* Moving Stars Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-20">
          {bgStars.map((s, i) => (
            <motion.div
              key={i}
              className="absolute bg-white rounded-full"
              style={{
                width: s.size + 'px',
                height: s.size + 'px',
                left: s.left + '%',
                top: '-5%',
                opacity: s.opacity + 0.3 // Increased opacity here
              }}
              animate={{
                y: ['0vh', '110vh']
              }}
              transition={{
                duration: s.duration,
                repeat: Infinity,
                ease: "linear",
                delay: s.delay
              }}
            />
          ))}
        </div>

        {/* Floating Abstract Stars */}
        <div className="absolute top-[18%] left-[12%] animate-pulse" style={{ animationDuration: '3s' }}>
          <Star className="w-10 h-10 text-cyan-300/80 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" fill="currentColor" />
        </div>
        <div className="absolute top-[65%] right-[8%] animate-pulse" style={{ animationDuration: '4.5s' }}>
          <Star className="w-16 h-16 text-blue-300/70 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" fill="currentColor" />
        </div>
        <div className="absolute bottom-[12%] left-[25%] animate-pulse" style={{ animationDuration: '5s' }}>
          <Star className="w-8 h-8 text-sky-300/90 drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]" fill="currentColor" />
        </div>

        {/* Glowing sparkles */}
        <Sparkles className="absolute top-[30%] right-[25%] w-8 h-8 text-cyan-300/80 animate-pulse drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        <Sparkles className="absolute bottom-[42%] left-[15%] w-6 h-6 text-blue-300/90 animate-pulse drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ animationDuration: '3s', animationDelay: '2s' }} />

        {/* Faded Giant Festival Characters */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12vw] font-black text-blue-300 opacity-[0.08] select-none pointer-events-none tracking-[0.2em] whitespace-nowrap mix-blend-screen drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]">
          EID MUBARAK
        </div>

        {/* Swinging Lantern Left */}
        <motion.div 
          className="absolute top-[-10px] left-[15%] hidden md:flex flex-col items-center opacity-95 drop-shadow-[0_0_20px_rgba(6,182,212,1)] pointer-events-none z-10"
          animate={{ rotate: [-6, 6, -6] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "top center" }}
        >
          <div className="w-0.5 h-24 bg-gradient-to-b from-transparent to-cyan-400"></div>
          <div className="w-6 h-4 bg-cyan-700 rounded-t-xl border border-cyan-300 z-10"></div>
          <div className="w-10 h-16 bg-blue-900/80 border-2 border-cyan-400 rounded-md relative flex justify-center items-center backdrop-blur-md">
             <div className="w-2.5 h-4 bg-yellow-300 rounded-full animate-pulse shadow-[0_0_15px_rgba(253,224,71,1)]"></div>
          </div>
          <div className="w-6 h-4 bg-cyan-700 rounded-b-xl border border-cyan-300 z-10"></div>
          <div className="w-0.5 h-8 bg-cyan-400 mt-1"></div>
        </motion.div>

        {/* Swinging Lantern Right */}
        <motion.div 
          className="absolute top-[-10px] right-[10%] hidden lg:flex flex-col items-center opacity-90 drop-shadow-[0_0_20px_rgba(6,182,212,1)] pointer-events-none z-10"
          animate={{ rotate: [5, -5, 5] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          style={{ transformOrigin: "top center" }}
        >
          <div className="w-0.5 h-32 bg-gradient-to-b from-transparent to-cyan-400"></div>
          <div className="w-8 h-5 bg-cyan-800 rounded-t-xl border border-cyan-300 z-10"></div>
          <div className="w-12 h-20 bg-blue-900/80 border-2 border-cyan-400 rounded-md relative flex justify-center items-center backdrop-blur-md">
             <div className="w-3 h-5 bg-yellow-300 rounded-full animate-pulse shadow-[0_0_15px_rgba(253,224,71,1)]"></div>
          </div>
          <div className="w-8 h-5 bg-cyan-800 rounded-b-xl border border-cyan-300 z-10"></div>
          <div className="w-0.5 h-10 bg-cyan-400 mt-1"></div>
        </motion.div>

        {/* Mosque Silhouette at bottom */}
        <div className="absolute bottom-[-10px] left-0 w-full flex justify-center items-end opacity-20 pointer-events-none mix-blend-screen overflow-hidden">
           <div className="w-full max-w-7xl flex items-end justify-center drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]">
              {/* Simple geometric mosque shapes */}
              <div className="w-16 h-32 bg-cyan-200 rounded-t-full mx-1 translate-y-4"></div>
              <div className="w-8 h-64 bg-blue-100 rounded-t-full mx-1"></div>
              <div className="w-24 h-48 bg-cyan-100 rounded-t-full mx-1 flex justify-center translate-y-2"></div>
              <div className="w-48 h-56 bg-sky-100 rounded-t-[100px] mx-1 relative"></div>
              <div className="w-24 h-48 bg-cyan-100 rounded-t-full mx-1 flex justify-center translate-y-2"></div>
              <div className="w-8 h-64 bg-blue-100 rounded-t-full mx-1"></div>
              <div className="w-16 h-32 bg-cyan-200 rounded-t-full mx-1 translate-y-4"></div>
           </div>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-6xl z-10 flex flex-col lg:flex-row gap-8 items-start justify-center"
      >
        {!state.success || lotteryData.length === 0 ? (
          <div className="w-full max-w-xl mx-auto mt-20">
            <Card className="border-neutral-800 bg-neutral-900/50 backdrop-blur-xl shadow-2xl">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl font-extrabold text-white flex items-center justify-center gap-2">
                  <Sparkles className="text-blue-400" />
                  Eid Card Lottery
                </CardTitle>
                <CardDescription className="text-neutral-400">
                  Enter your API bearer token to load participants.
                </CardDescription>
              </CardHeader>
              <form action={(formData) => {
                const t = formData.get("token")?.toString() || "";
                setActiveToken(t);
                sessionStorage.setItem("lotteryToken", t);
                startTransition(() => formAction(formData));
              }}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="token" className="text-neutral-300">Bearer Token</Label>
                    <Input
                      id="token"
                      name="token"
                      placeholder="xyz token"
                      value={tempToken}
                      onChange={(e) => setTempToken(e.target.value)}
                      required
                      className="border-neutral-700 bg-neutral-950 text-white focus-visible:ring-blue-500"
                    />
                    {state?.errors?.token && (
                      <p className="text-sm text-red-500 font-medium">
                        {state.errors.token.join(", ")}
                      </p>
                    )}
                    {state?.message && !state.success && (
                      <p className="text-sm text-red-400 font-medium bg-red-950/30 p-3 rounded-md border border-red-900/50">
                        {state.message}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    disabled={isPending}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-6 text-lg transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
                  >
                    {isPending ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Data</>
                    ) : (
                      "Load Participants"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        ) : (
          <>
            {/* SPINNER SECTION */}
            <div className="flex-1 flex flex-col items-center w-full max-w-2xl bg-neutral-900/40 p-8 rounded-3xl border border-neutral-800 backdrop-blur-sm shadow-2xl relative">
              <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="text-center mb-8"
              >
                <h1 className="text-4xl lg:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 drop-shadow-sm text-center">
                  Phitron Wheel of Salami
                </h1>
                <p className="text-neutral-400 text-lg">
                  {lotteryData.length} participants ready to win
                </p>
              </motion.div>

              {/* FAST TICKER - Shows random names rapidly while spinning to build suspense */}
              <div className="h-16 mb-6 flex flex-col items-center justify-center w-full max-w-sm rounded-2xl bg-neutral-950/80 border border-neutral-800 shadow-[inset_0_2px_15px_rgba(0,0,0,0.8)] overflow-hidden relative">
                {isSpinning && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent animate-pulse pointer-events-none"></div>
                )}
                
                {isSpinning ? (
                  <span className="text-2xl font-black text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] tracking-wider truncate px-6 w-full text-center">
                    {tickerName || "..."}
                  </span>
                ) : (
                  <span className="text-sm border border-neutral-800 text-neutral-400 uppercase tracking-widest font-semibold flex items-center gap-2 bg-neutral-900 px-5 py-2 rounded-full shadow-sm">
                    <Sparkles className="w-4 h-4 text-cyan-400" /> Ready to Roll
                  </span>
                )}
              </div>

              {/* WHEEL CONTAINER */}
              <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center mb-10 overflow-visible">
                {/* Outer Glow & Border */}
                <div className="absolute inset-0 rounded-full border-8 border-neutral-800 shadow-[0_0_50px_rgba(59,130,246,0.15)] bg-neutral-950 z-0"></div>
                
                {/* Sharp SVG Pointer / Marker (Top) */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_6px_10px_rgba(0,0,0,0.8)]">
                  <svg width="44" height="60" viewBox="0 0 44 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="origin-top relative z-10">
                    {/* Main sharp triangle pointer */}
                    <path d="M22 58L4 4H40L22 58Z" fill="url(#pointerGradient)" stroke="#27272a" strokeWidth="2" strokeLinejoin="round"/>
                    {/* Inner glowing dot */}
                    <circle cx="22" cy="16" r="6" fill="#0ea5e9" stroke="#fff" strokeWidth="2" />
                    <defs>
                      <linearGradient id="pointerGradient" x1="22" y1="0" x2="22" y2="60" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#ffffff" />
                        <stop offset="1" stopColor="#d4d4d8" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* The Rotating Wheel */}
                <motion.div 
                  className="w-[98%] h-[98%] rounded-full overflow-hidden relative z-10 shadow-inner origin-center"
                  animate={{ rotate: rotation }}
                  transition={{ 
                    duration: 4.5, 
                    ease: [0.15, 0.85, 0.35, 1], // Custom bouncy ease out
                    type: "tween" 
                  }}
                >
                  <svg width="100%" height="100%" viewBox="0 0 400 400" className="w-full h-full font-bold">
                    {availableData.length > 0 && availableData.map((item, index) => {
                      const startAngle = index * sliceAngle;
                      const endAngle = startAngle + sliceAngle;
                      const color = wheelColors[index % wheelColors.length];
                      
                      // For text position, rotate middle of slice
                      const midAngle = startAngle + sliceAngle / 2;
                      
                      // Limit text if there are too many items
                      let displayName = getDisplayName(item);
                      if (displayName.length > 15) displayName = displayName.substring(0, 15) + "...";
                      if (availableData.length > 40) displayName = ""; // Hide text if too small
                      
                      return (
                        <g key={index}>
                          <path 
                            d={describeArc(cx, cy, radius, startAngle, endAngle)} 
                            fill={color} 
                            stroke="rgba(0,0,0,0.1)" 
                            strokeWidth="2"
                          />
                          <g transform={`rotate(${midAngle}, ${cx}, ${cy})`}>
                            {/* Move text to be positioned on the radius */}
                            <text 
                              x={cx} 
                              y={cy - radius * 0.55} 
                              fill="white" 
                              fontSize={availableData.length > 20 ? "10" : "14"}
                              textAnchor="middle" 
                              transform={`rotate(0, ${cx}, ${cy - radius * 0.55})`}
                              style={{ textShadow: "0px 1px 3px rgba(0,0,0,0.8)" }}
                            >
                              {displayName}
                            </text>
                          </g>
                        </g>
                      );
                    })}
                  </svg>
                  
                  {/* Wheel Center Hub */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-neutral-800 border-4 border-neutral-700 rounded-full z-10 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.6),0_2px_8px_rgba(0,0,0,0.5)]">
                    <div className="w-4 h-4 rounded-full bg-neutral-500 shadow-inner"></div>
                  </div>
                </motion.div>
              </div>

              <Button
                onClick={startSpin}
                disabled={isSpinning || availableData.length === 0}
                className="w-full max-w-sm py-8 text-2xl font-black rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:scale-[1.02] transition-transform text-white shadow-[0_0_30px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:hover:scale-100 border-2 border-cyan-400/30 uppercase tracking-widest"
              >
                {isSpinning ? "Spinning..." : availableData.length === 0 ? "No Participants Left" : "Tap to Spin!"}
              </Button>

              <div className="mt-6 flex flex-wrap gap-4 w-full justify-center lg:max-w-2xl">
                <Button
                  className="bg-transparent text-neutral-400 border border-neutral-800 hover:bg-neutral-800 hover:text-white"
                  onClick={() => {
                    setLotteryData([]);
                    setWinner(null);
                    setRotation(0);
                    sessionStorage.removeItem("lotteryData");
                  }}
                  disabled={isSpinning}
                >
                  Change Token
                </Button>
                <Button
                  className="bg-transparent text-blue-400 border border-blue-900/30 hover:bg-blue-950 hover:text-blue-300"
                  onClick={() => {
                    if (!activeToken) return;
                    const fd = new FormData();
                    fd.append("token", activeToken);
                    startTransition(() => formAction(fd));
                  }}
                  disabled={isSpinning || isPending}
                >
                  {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Reload Data
                </Button>
                <Button
                  className="bg-transparent text-red-400 border border-red-900/30 hover:bg-red-950 hover:text-red-300"
                  onClick={() => { sessionStorage.removeItem("lotteryWinners"); setPrizeHistory([]); }}
                  disabled={isSpinning || prizeHistory.length === 0}
                >
                  Clear History
                </Button>
              </div>
            </div>

            {/* RESULTS & HISTORY SECTION */}
            <div className="w-full max-w-sm lg:w-96 flex flex-col gap-6 items-center">
              
              <AnimatePresence mode="popLayout">
                {winner && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="w-full"
                  >
                    <Card className="border-cyan-500/50 bg-gradient-to-br from-blue-900/40 to-sky-950/40 backdrop-blur-md shadow-[0_0_40px_rgba(6,182,212,0.15)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl"></div>
                      <CardHeader className="pb-2 text-center">
                        <CardTitle className="text-xl text-cyan-400 flex justify-center items-center gap-2 uppercase tracking-widest font-bold">
                          <Trophy className="w-6 h-6 animate-pulse" />
                          We Have A Winner!
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-center pt-4 pb-6">
                        <h2 className="text-3xl font-black text-white mb-2 leading-tight">
                          {getDisplayName(winner)}
                        </h2>
                        {getSecondaryLabel(winner) && (
                          <p className="text-neutral-300 font-medium bg-black/40 inline-flex px-3 py-1 rounded-full text-sm">
                            {getSecondaryLabel(winner)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <Card className="w-full border-neutral-800 bg-neutral-900/60 backdrop-blur-md flex-1 max-h-[600px] flex flex-col overflow-hidden">
                <CardHeader className="pb-4 border-b border-neutral-800 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                       <History className="w-5 h-5 text-blue-400" />
                       Recent Winners
                    </CardTitle>
                    <CardDescription className="text-neutral-400">
                      Saved to session
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-neutral-800 text-neutral-300 font-bold px-3 py-1 rounded-full text-xs">
                      {prizeHistory.length}
                    </div>
                    {prizeHistory.length > 0 && (
                      <button
                        onClick={exportWinners}
                        className="p-1.5 bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 rounded-md transition-colors"
                        title="Export Winners to CSV"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0 overflow-y-auto w-full custom-scrollbar flex-1 relative">
                  {prizeHistory.length === 0 ? (
                    <div className="flex items-center justify-center p-8 text-neutral-500 text-center h-48 italic">
                      No winners yet. Spin the wheel!
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-800/80">
                      {prizeHistory.map((item, idx) => (
                        <motion.div 
                          key={`${idx}-${getDisplayName(item)}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-center gap-4 p-4 hover:bg-neutral-800/50 transition-colors"
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-400 border border-neutral-700">
                            #{prizeHistory.length - idx}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-white truncate">
                              {getDisplayName(item)}
                            </h3>
                            {getSecondaryLabel(item) && (
                              <p className="text-xs text-neutral-400 truncate mt-0.5">
                                {getSecondaryLabel(item)}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
