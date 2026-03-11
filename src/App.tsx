import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Activity, MessageSquare, Bot, Zap, Eye, BrainCircuit, Power, RefreshCw } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  
  const [robotState, setRobotState] = useState({
    emoji: '🤖',
    action: '待机中 (Standby)',
    head: '居中 (Center)',
    antenna: '平静 (Calm)',
  });
  
  const [innerThoughts, setInnerThoughts] = useState<{id: number, text: string, type: 'system' | 'os' | 'obs'}[]>([
    { id: 1, text: '系统启动完成...', type: 'system' },
    { id: 2, text: '等待视觉输入...', type: 'system' }
  ]);
  
  const addThought = (text: string, type: 'system' | 'os' | 'obs') => {
    setInnerThoughts(prev => {
      const newThoughts = [...prev, { id: Date.now(), text, type }];
      return newThoughts.slice(-8); // Keep last 8 thoughts
    });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        addThought('摄像头已连接，视觉模块上线。', 'system');
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      addThought("❌ 无法访问摄像头，请检查权限。", 'system');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
      setAutoMode(false);
      addThought('摄像头已断开，视觉模块休眠。', 'system');
      setRobotState({
        emoji: '😴',
        action: '休眠中 (Sleeping)',
        head: '低垂 (Down)',
        antenna: '关闭 (Off)',
      });
    }
  };

  const analyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive || isAnalyzing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = imageDataUrl.split(',')[1];

    setIsAnalyzing(true);
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-preview",
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "image/jpeg"
            }
          },
          "Analyze the person in the image. Return a JSON object representing the robot's reaction. 'userAction' (briefly what the person is doing/feeling), 'robotEmoji' (an emoji representing the robot imitating them), 'robotAction' (what the robot is doing, e.g., '模仿微笑'), 'robotHead' (e.g., '向左倾斜', '向上看'), 'robotAntenna' (e.g., '开心晃动', '警觉竖起'), 'innerThought' (a funny, curious inner monologue in Chinese, e.g., '这个人好奇怪，在干什么')."
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              userAction: { type: Type.STRING },
              robotEmoji: { type: Type.STRING },
              robotAction: { type: Type.STRING },
              robotHead: { type: Type.STRING },
              robotAntenna: { type: Type.STRING },
              innerThought: { type: Type.STRING }
            },
            required: ["userAction", "robotEmoji", "robotAction", "robotHead", "robotAntenna", "innerThought"]
          }
        }
      });

      if (response.text) {
        const result = JSON.parse(response.text);
        setRobotState({
          emoji: result.robotEmoji,
          action: result.robotAction,
          head: result.robotHead,
          antenna: result.robotAntenna,
        });
        addThought(`[观察] 用户正在: ${result.userAction}`, 'obs');
        addThought(`[内心OS] ${result.innerThought}`, 'os');
      }
    } catch (error) {
      console.error("Analysis error:", error);
      addThought("⚠️ 分析出错，可能是网络波动...", 'system');
    } finally {
      setIsAnalyzing(false);
    }
  }, [isCameraActive, isAnalyzing]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCameraActive && autoMode) {
      interval = setInterval(() => {
        analyzeFrame();
      }, 6000);
    }
    return () => clearInterval(interval);
  }, [isCameraActive, autoMode, analyzeFrame]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 font-sans p-4 md:p-8">
      <header className="max-w-7xl mx-auto mb-8 flex items-center justify-between border-b border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">情绪之镜 <span className="text-indigo-400 font-mono text-sm ml-2">v1.0</span></h1>
            <p className="text-xs text-gray-500 font-mono">Reachymin + J4012 Desktop Robot Demo</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={isCameraActive ? stopCamera : startCamera}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              isCameraActive 
                ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
            }`}
          >
            <Power className="w-4 h-4" />
            {isCameraActive ? '关闭系统' : '启动系统'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Camera Feed */}
        <section className="bg-[#141414] rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">视觉输入 (User)</h2>
            </div>
            {isCameraActive && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-mono text-emerald-500">LIVE</span>
              </div>
            )}
          </div>
          <div className="relative flex-1 min-h-[300px] bg-black flex items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`absolute inset-0 w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`}
            />
            {!isCameraActive && (
              <div className="text-center text-gray-600 flex flex-col items-center gap-3">
                <Eye className="w-12 h-12 opacity-20" />
                <p className="text-sm">摄像头未开启</p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Overlay Grid */}
            {isCameraActive && (
              <div className="absolute inset-0 pointer-events-none border-[1px] border-emerald-500/20 grid grid-cols-3 grid-rows-3">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="border-[0.5px] border-emerald-500/10" />
                ))}
              </div>
            )}
          </div>
          <div className="p-4 bg-[#1a1a1a] border-t border-gray-800 flex justify-between items-center">
            <button
              onClick={() => setAutoMode(!autoMode)}
              disabled={!isCameraActive}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                autoMode 
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                  : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 disabled:opacity-50'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${autoMode ? 'animate-spin' : ''}`} />
              自动分析 (Auto)
            </button>
            <button
              onClick={analyzeFrame}
              disabled={!isCameraActive || isAnalyzing}
              className="flex items-center gap-2 px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 border border-gray-700"
            >
              <Zap className="w-3 h-3 text-yellow-400" />
              {isAnalyzing ? '分析中...' : '手动抓取 (Capture)'}
            </button>
          </div>
        </section>

        {/* Panel 2: Robot State */}
        <section className="bg-[#141414] rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">物理状态 (Robot)</h2>
            </div>
          </div>
          <div className="flex-1 p-6 flex flex-col items-center justify-center gap-8">
            <motion.div 
              key={robotState.emoji}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-8xl filter drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            >
              {robotState.emoji}
            </motion.div>
            
            <div className="w-full space-y-4">
              <div className="bg-[#0a0a0a] p-3 rounded-lg border border-gray-800 flex justify-between items-center">
                <span className="text-xs text-gray-500 font-mono uppercase">Action</span>
                <span className="text-sm text-indigo-300 font-medium">{robotState.action}</span>
              </div>
              <div className="bg-[#0a0a0a] p-3 rounded-lg border border-gray-800 flex justify-between items-center">
                <span className="text-xs text-gray-500 font-mono uppercase">Head Pos</span>
                <span className="text-sm text-gray-300">{robotState.head}</span>
              </div>
              <div className="bg-[#0a0a0a] p-3 rounded-lg border border-gray-800 flex justify-between items-center">
                <span className="text-xs text-gray-500 font-mono uppercase">Antenna</span>
                <span className="text-sm text-gray-300">{robotState.antenna}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Panel 3: Inner Thoughts */}
        <section className="bg-[#141414] rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">心理活动 (0.8B LLM)</h2>
            </div>
          </div>
          <div className="flex-1 p-4 bg-[#0a0a0a] font-mono text-sm overflow-y-auto flex flex-col justify-end">
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {innerThoughts.map((thought) => (
                  <motion.div
                    key={thought.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded border ${
                      thought.type === 'system' 
                        ? 'bg-gray-900/50 border-gray-800 text-gray-500' 
                        : thought.type === 'obs'
                        ? 'bg-blue-900/10 border-blue-900/30 text-blue-300'
                        : 'bg-indigo-900/20 border-indigo-500/30 text-indigo-200'
                    }`}
                  >
                    <span className="mr-2 opacity-50">
                      {new Date(thought.id).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    </span>
                    {thought.text}
                  </motion.div>
                ))}
              </AnimatePresence>
              {isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 rounded border bg-gray-900/50 border-gray-800 text-gray-500 flex items-center gap-2"
                >
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  正在思考...
                </motion.div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
