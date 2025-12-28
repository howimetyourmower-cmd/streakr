"use client";

import { useState, useEffect } from 'react';

export default function PicksPageRedesign() {
  const [userStreak, setUserStreak] = useState(8);
  const [leaderStreak, setLeaderStreak] = useState(12);
  const [selectedPicks, setSelectedPicks] = useState({
    'q1-1': 'yes',
    'q1-2': null,
    'q2-1': 'no',
    'q2-2': 'yes',
  });

  // Sample games data
  const games = [
    {
      id: 'game-1',
      match: 'Collingwood vs Carlton',
      venue: 'MCG',
      startTime: '2025-03-28T19:50:00',
      isLocked: false,
      picksLockIn: 240, // seconds
      questions: [
        {
          id: 'q1-1',
          quarter: 1,
          question: 'Will Nick Daicos have 30+ disposals?',
          status: 'open',
          yesPercent: 67,
          noPercent: 33,
          commentCount: 124,
          isSponsor: false,
        },
        {
          id: 'q1-2',
          quarter: 1,
          question: 'Will Charlie Curnow kick 3+ goals?',
          status: 'open',
          yesPercent: 82,
          noPercent: 18,
          commentCount: 89,
          isSponsor: true,
        },
        {
          id: 'q1-3',
          quarter: 2,
          question: 'Will the total score exceed 50 points?',
          status: 'open',
          yesPercent: 55,
          noPercent: 45,
          commentCount: 45,
          isSponsor: false,
        },
      ],
    },
    {
      id: 'game-2',
      match: 'Richmond vs Geelong',
      venue: 'Marvel Stadium',
      startTime: '2025-03-28T19:20:00',
      isLocked: false,
      picksLockIn: 480,
      questions: [
        {
          id: 'q2-1',
          quarter: 1,
          question: 'Will Tom Lynch kick 2+ goals in Q1?',
          status: 'final',
          yesPercent: 45,
          noPercent: 55,
          commentCount: 67,
          isSponsor: false,
          correctOutcome: 'no',
        },
        {
          id: 'q2-2',
          quarter: 2,
          question: 'Will Jeremy Cameron have 4+ marks?',
          status: 'final',
          yesPercent: 71,
          noPercent: 29,
          commentCount: 92,
          isSponsor: false,
          correctOutcome: 'yes',
        },
      ],
    },
  ];

  const handlePick = (questionId, pick) => {
    setSelectedPicks(prev => ({ ...prev, [questionId]: pick }));
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white">
      <style jsx>{`
        @keyframes neonPulse {
          0%, 100% { opacity: 1; filter: drop-shadow(0 0 8px currentColor); }
          50% { opacity: 0.8; filter: drop-shadow(0 0 16px currentColor); }
        }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes pickConfirm {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .neon-pulse { animation: neonPulse 2s ease-in-out infinite; }
        .slide-up { animation: slideUp 0.3s ease-out; }
        .scale-in { animation: scaleIn 0.3s ease-out; }
        .pick-confirm { animation: pickConfirm 0.3s ease-out; }
      `}</style>

      {/* PERSISTENT STREAK WIDGET - Always Visible */}
      <div className="sticky top-0 z-50 bg-[#0D1117]/95 backdrop-blur-md border-b border-[#FF3D00]/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60 uppercase tracking-wide">Current Streak</span>
                <div className="px-3 py-1 rounded-full bg-gradient-to-r from-[#FF3D00] to-[#F50057] shadow-[0_0_20px_rgba(255,61,0,0.6)]">
                  <span className="text-xl font-extrabold text-white">{userStreak}</span>
                </div>
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div className="text-xs">
                <span className="text-white/60">Leader: </span>
                <span className="text-[#00E5FF] font-bold">{leaderStreak}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/10 border border-[#00E5FF]/30">
                <span className="text-xs text-[#00E5FF]">3 picks pending</span>
              </div>
              <button className="px-4 py-1.5 rounded-full bg-[#FF3D00] hover:bg-[#FF5722] text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(255,61,0,0.5)]">
                Share Streak
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {/* PAGE HEADER */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-1 w-12 bg-gradient-to-r from-[#FF3D00] to-[#F50057]" />
            <h1 className="text-3xl font-extrabold">
              ROUND <span className="text-[#FF3D00]">12</span> PICKS
            </h1>
          </div>
          <p className="text-sm text-white/60 ml-16">
            Make your picks • Lock in your streak • Dominate the leaderboard
          </p>
        </div>

        {/* DASHBOARD STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-2xl bg-[#0D1117] border border-[#21262D] p-4 hover:border-[#FF3D00]/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/60 uppercase tracking-wide">Picks Made</span>
              <span className="text-[#76FF03]">●</span>
            </div>
            <div className="text-2xl font-extrabold text-white">4 / 12</div>
            <div className="text-xs text-white/50 mt-1">8 questions still open</div>
          </div>

          <div className="rounded-2xl bg-[#0D1117] border border-[#21262D] p-4 hover:border-[#00E5FF]/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/60 uppercase tracking-wide">Accuracy</span>
              <span className="text-[#00E5FF]">●</span>
            </div>
            <div className="text-2xl font-extrabold text-[#00E5FF]">73%</div>
            <div className="text-xs text-white/50 mt-1">Above average 🔥</div>
          </div>

          <div className="rounded-2xl bg-[#0D1117] border border-[#21262D] p-4 hover:border-[#F50057]/50 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/60 uppercase tracking-wide">Next Lock</span>
              <span className="text-[#F50057] neon-pulse">●</span>
            </div>
            <div className="text-2xl font-extrabold text-[#F50057]">4:32</div>
            <div className="text-xs text-white/50 mt-1">Collingwood vs Carlton</div>
          </div>
        </div>

        {/* SPONSOR ALERT */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-[#FFD700]/10 via-transparent to-transparent border border-[#FFD700]/30 p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <div className="text-sm font-bold text-[#FFD700] mb-1">SPONSOR QUESTION ACTIVE</div>
              <div className="text-xs text-white/70">Get it right to enter the $100 gift card draw</div>
            </div>
          </div>
        </div>

        {/* GAMES LIST */}
        <div className="space-y-6">
          {games.map((game, gameIdx) => {
            const picksMade = game.questions.filter(q => selectedPicks[q.id]).length;
            const totalQuestions = game.questions.length;
            const isGameComplete = game.questions.every(q => q.status === 'final');

            return (
              <div key={game.id} className="slide-up">
                {/* GAME HEADER */}
                <div className="rounded-2xl bg-[#0D1117] border-2 border-[#FF3D00]/30 p-5 mb-3 hover:border-[#FF3D00]/60 transition-all shadow-[0_0_30px_rgba(255,61,0,0.15)]">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    
                    {/* Match Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="px-2 py-1 rounded-md bg-[#FF3D00]/20 border border-[#FF3D00]/40">
                          <span className="text-[10px] font-bold text-[#FF3D00] uppercase tracking-wide">
                            Game {gameIdx + 1}
                          </span>
                        </div>
                        {!game.isLocked && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#76FF03]/10 border border-[#76FF03]/30">
                            <span className="h-2 w-2 rounded-full bg-[#76FF03] neon-pulse" />
                            <span className="text-[10px] font-bold text-[#76FF03] uppercase">LIVE</span>
                          </div>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-extrabold text-white mb-1">{game.match}</h3>
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <span>{game.venue}</span>
                        <span>•</span>
                        <span>Fri, 28 Mar • 7:50 PM AEDT</span>
                      </div>
                    </div>

                    {/* Game Stats */}
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xs text-white/50 mb-1">Your Picks</div>
                        <div className="text-2xl font-extrabold text-[#00E5FF]">
                          {picksMade}/{totalQuestions}
                        </div>
                      </div>
                      
                      {!game.isLocked && (
                        <>
                          <div className="h-12 w-px bg-white/20" />
                          <div className="text-center">
                            <div className="text-xs text-white/50 mb-1">Locks In</div>
                            <div className="text-xl font-extrabold text-[#F50057]">
                              {formatCountdown(game.picksLockIn)}
                            </div>
                          </div>
                        </>
                      )}

                      {isGameComplete && (
                        <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#76FF03]/20 to-transparent border border-[#76FF03]/40">
                          <div className="text-xs text-[#76FF03] font-bold">✓ CLEAN SWEEP</div>
                          <div className="text-lg font-extrabold text-[#76FF03]">+2</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {!isGameComplete && (
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] text-white/60 mb-1">
                        <span>Pick Progress</span>
                        <span>{picksMade === totalQuestions ? 'All picked!' : `${totalQuestions - picksMade} left`}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#21262D] overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#FF3D00] to-[#F50057] transition-all duration-500"
                          style={{ width: `${(picksMade / totalQuestions) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* QUESTIONS */}
                <div className="space-y-3">
                  {game.questions.map((question) => {
                    const userPick = selectedPicks[question.id];
                    const isCorrect = question.status === 'final' && question.correctOutcome === userPick;
                    const isWrong = question.status === 'final' && userPick && question.correctOutcome !== userPick;

                    return (
                      <div 
                        key={question.id}
                        className={`rounded-2xl bg-[#0D1117] border transition-all ${
                          isCorrect ? 'border-[#76FF03] shadow-[0_0_20px_rgba(118,255,3,0.3)]' :
                          isWrong ? 'border-[#FF073A] shadow-[0_0_20px_rgba(255,7,58,0.3)]' :
                          'border-[#21262D] hover:border-[#FF3D00]/50'
                        } p-5`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          
                          {/* Question Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="px-2 py-1 rounded-md bg-[#00E5FF]/10 border border-[#00E5FF]/30">
                                <span className="text-[10px] font-bold text-[#00E5FF]">Q{question.quarter}</span>
                              </div>
                              
                              {question.isSponsor && (
                                <div className="px-2 py-1 rounded-md bg-gradient-to-r from-[#FFD700]/20 to-[#FFA500]/20 border border-[#FFD700]/40">
                                  <span className="text-[10px] font-bold text-[#FFD700]">💰 $100 SPONSOR</span>
                                </div>
                              )}

                              {question.status !== 'open' && (
                                <div className="px-2 py-1 rounded-md bg-white/10">
                                  <span className="text-[10px] font-bold text-white/70 uppercase">{question.status}</span>
                                </div>
                              )}
                            </div>

                            <h4 className="text-base font-semibold text-white mb-3 leading-relaxed">
                              {question.question}
                            </h4>

                            {/* Crowd Sentiment */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
                                <span>CROWD PICKS</span>
                                <span>{question.yesPercent}% YES • {question.noPercent}% NO</span>
                              </div>
                              <div className="flex h-2 rounded-full overflow-hidden bg-[#21262D]">
                                <div 
                                  className="bg-[#76FF03] transition-all duration-500"
                                  style={{ width: `${question.yesPercent}%` }}
                                />
                                <div 
                                  className="bg-[#FF073A] transition-all duration-500"
                                  style={{ width: `${question.noPercent}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-white/40 mt-1">
                                <span>YES ({question.yesPercent}%)</span>
                                <span>NO ({question.noPercent}%)</span>
                              </div>
                            </div>

                            {/* Comments */}
                            <button className="text-xs text-[#00E5FF] hover:text-[#00E5FF]/80 font-semibold flex items-center gap-1">
                              💬 {question.commentCount} {question.commentCount > 100 && '🔥'}
                            </button>
                          </div>

                          {/* Pick Buttons */}
                          <div className="flex flex-col gap-3 lg:min-w-[200px]">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handlePick(question.id, 'yes')}
                                disabled={question.status !== 'open'}
                                className={`flex-1 py-3 rounded-xl text-sm font-extrabold transition-all ${
                                  userPick === 'yes'
                                    ? 'bg-[#76FF03] text-black shadow-[0_0_25px_rgba(118,255,3,0.6)] scale-105 pick-confirm'
                                    : question.status === 'open'
                                    ? 'bg-[#76FF03]/20 text-[#76FF03] border border-[#76FF03]/40 hover:bg-[#76FF03]/30'
                                    : 'bg-[#76FF03]/10 text-[#76FF03]/40 cursor-not-allowed'
                                }`}
                              >
                                YES
                              </button>

                              <button
                                onClick={() => handlePick(question.id, 'no')}
                                disabled={question.status !== 'open'}
                                className={`flex-1 py-3 rounded-xl text-sm font-extrabold transition-all ${
                                  userPick === 'no'
                                    ? 'bg-[#FF073A] text-white shadow-[0_0_25px_rgba(255,7,58,0.6)] scale-105 pick-confirm'
                                    : question.status === 'open'
                                    ? 'bg-[#FF073A]/20 text-[#FF073A] border border-[#FF073A]/40 hover:bg-[#FF073A]/30'
                                    : 'bg-[#FF073A]/10 text-[#FF073A]/40 cursor-not-allowed'
                                }`}
                              >
                                NO
                              </button>
                            </div>

                            {/* Outcome Badge */}
                            {question.status === 'final' && (
                              <div className={`px-3 py-2 rounded-xl text-center text-xs font-bold ${
                                isCorrect 
                                  ? 'bg-[#76FF03]/20 border border-[#76FF03]/50 text-[#76FF03]'
                                  : isWrong
                                  ? 'bg-[#FF073A]/20 border border-[#FF073A]/50 text-[#FF073A]'
                                  : 'bg-white/10 border border-white/20 text-white/70'
                              }`}>
                                {isCorrect ? '✓ CORRECT +1' : isWrong ? '✗ WRONG (RESET)' : 'NO PICK'}
                              </div>
                            )}

                            {/* Clear Button */}
                            {userPick && question.status === 'open' && (
                              <button
                                onClick={() => handlePick(question.id, null)}
                                className="text-xs text-white/50 hover:text-white transition-colors"
                              >
                                ✕ Clear pick
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* FLOATING CALL TO ACTION */}
        <div className="fixed bottom-6 right-6 z-40">
          <button className="px-6 py-4 rounded-2xl bg-gradient-to-r from-[#FF3D00] to-[#F50057] text-white font-extrabold text-sm shadow-[0_0_40px_rgba(255,61,0,0.6)] hover:shadow-[0_0_60px_rgba(255,61,0,0.8)] transition-all scale-in flex items-center gap-2">
            <span>Submit 3 Picks</span>
            <span className="text-xl">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
