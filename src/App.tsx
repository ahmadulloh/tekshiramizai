import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  Trash2, 
  Clipboard, 
  Check, 
  Search, 
  History, 
  User, 
  Calendar, 
  Globe, 
  Building2, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Loader2, 
  Printer, 
  RefreshCw, 
  FileText, 
  Cpu, 
  Activity, 
  Clock, 
  BookOpen, 
  ExternalLink,
  Download,
  Image as ImageIcon,
  Settings,
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toPng } from "html-to-image";
import { DocumentAnalysisData, HistoryRecord } from "./types";

export default function App() {
  // State for uploaded images
  const [uploadedImages, setUploadedImages] = useState<{ base64: string; name: string; mimeType: string; thumbnail?: string }[]>([]);
  const [preferredModel, setPreferredModel] = useState<"anthropic" | "gemini">("gemini");
  
  // Custom personal API keys stored safely in user's browser localStorage
  const [userGeminiKey, setUserGeminiKey] = useState<string>(() => localStorage.getItem("user_gemini_api_key") || "");
  const [userAnthropicKey, setUserAnthropicKey] = useState<string>(() => localStorage.getItem("user_anthropic_api_key") || "");
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisData | null>(null);
  const [modelUsedResult, setModelUsedResult] = useState<string>("");
  const [systemWarnings, setSystemWarnings] = useState<string[]>([]);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  // History and Stats states
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedState, setCopiedState] = useState<boolean>(false);
  
  // Drag and drop border active state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  // Custom loader messages
  const [loadingMessage, setLoadingMessage] = useState<string>("Hujjat yuklanmoqda...");
  const loaderMessageInterval = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("deport_checker_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed loading history from localStorage:", e);
    }
  }, []);

  // Sync history structure and compute statistics
  const saveRecordToHistory = (data: DocumentAnalysisData, images: string[], model: string) => {
    const record: HistoryRecord = {
      id: "rec_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      timestamp: new Date().toLocaleString("uz-UZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      modelUsed: model,
      data,
      rawImages: images
    };

    const newHistory = [record, ...history].slice(0, 10); // Keep max 10 records
    setHistory(newHistory);
    
    try {
      localStorage.setItem("deport_checker_history", JSON.stringify(newHistory));
    } catch (err) {
      console.warn("localStorage quota exceeded! Stripping base64 images to prevent crashing storage...", err);
      // Fallback: strip image payloads so text search still records perfectly!
      const safeHistory = newHistory.map(rec => ({
        ...rec,
        rawImages: []
      }));
      try {
        localStorage.setItem("deport_checker_history", JSON.stringify(safeHistory));
        setHistory(safeHistory);
      } catch (innerErr) {
        console.error("Critical: localStorage completely blocked:", innerErr);
      }
    }
  };

  // Delete checking item from history
  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = history.filter(item => item.id !== id);
    setHistory(filtered);
    localStorage.setItem("deport_checker_history", JSON.stringify(filtered));
  };

  // Clear entire check history
  const clearAllHistory = () => {
    if (window.confirm("Barcha tekshiruvlar tarixini butunlay o'chirmoqchimisiz?")) {
      setHistory([]);
      localStorage.removeItem("deport_checker_history");
    }
  };

  // Drag-and-drop mechanics
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const fileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // Convert files to base64 structure and state
  const processFiles = (files: FileList) => {
    const totalFiles = Array.from(files);
    const imageFiles = totalFiles.filter(file => file.type.startsWith("image/"));
    
    if (imageFiles.length === 0) {
      alert("Iltimos, faqat rasm formatidagi fayllarni yuklang (.jpg, .jpeg, .png, .webp).");
      return;
    }

    if (uploadedImages.length + imageFiles.length > 4) {
      alert("Maksimal 4 tagacha hujjat rasmini bir vaqtda yuklash mumkin.");
      return;
    }

    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        
        // Asynchronously generate a small low-res JPEG thumbnail (~3KB instead of ~3MB)
        const imgObj = new Image();
        imgObj.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 120; // max size in px
          let width = imgObj.width;
          let height = imgObj.height;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          let thumbData = "";
          if (ctx) {
            ctx.drawImage(imgObj, 0, 0, width, height);
            thumbData = canvas.toDataURL("image/jpeg", 0.5); // 50% compress
          }
          
          setUploadedImages(prev => [
            ...prev,
            {
              base64: base64Data,
              name: file.name,
              mimeType: file.type,
              thumbnail: thumbData || base64Data
            }
          ]);
        };
        imgObj.onerror = () => {
          setUploadedImages(prev => [
            ...prev,
            {
              base64: base64Data,
              name: file.name,
              mimeType: file.type,
              thumbnail: base64Data
            }
          ]);
        };
        imgObj.src = base64Data;
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove thumbnail
  const removeThumbnail = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Loading indicator dynamic rotation of text
  useEffect(() => {
    const loadingTexts = [
      "Hujjat yuklanmoqda...",
      "OCR tizimi rasm ma'lumotlarini matnga o'g'irmoqdi...",
      "Sud va immigratsiya qarorlari tahlil qilinmoqda...",
      "Taqiq va deportatsiya muddati hisoblanmoqda...",
      "Ism va familiya daxlsizligi Latin va Kirillda solishtirilmoqda...",
      "O'zbek tilidagi qonuniy xulosa tayyorlanmoqda...",
      "Warning card shakllantirilmoqda..."
    ];

    if (isAnalyzing) {
      let step = 0;
      setLoadingMessage(loadingTexts[0]);
      loaderMessageInterval.current = setInterval(() => {
        step = (step + 1) % loadingTexts.length;
        setLoadingMessage(loadingTexts[step]);
      }, 3000);
    } else {
      if (loaderMessageInterval.current) {
        clearInterval(loaderMessageInterval.current);
      }
    }

    return () => {
      if (loaderMessageInterval.current) {
        clearInterval(loaderMessageInterval.current);
      }
    };
  }, [isAnalyzing]);

  // Request document extraction analysis
  const executeAnalysis = async () => {
    if (uploadedImages.length === 0) {
      alert("Iltimos, avval tahlil qilish uchun 1-4 ta immigratsiya hujjati rasmini yuklang.");
      return;
    }

    setIsAnalyzing(true);
    setErrorStatus(null);
    setAnalysisResult(null);
    setSystemWarnings([]);

    try {
      const headersValue: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (userGeminiKey && userGeminiKey.trim()) {
        headersValue["X-Gemini-Key"] = userGeminiKey.trim();
      }
      if (userAnthropicKey && userAnthropicKey.trim()) {
        headersValue["X-Anthropic-Key"] = userAnthropicKey.trim();
      }

      const response = await fetch("/api/analyze-documents", {
        method: "POST",
        headers: headersValue,
        body: JSON.stringify({
          images: uploadedImages.map(img => ({ base64: img.base64, mimeType: img.mimeType })),
          preferredModel: preferredModel
        })
      });

      const jsonResult = await response.json();

      if (!response.ok || !jsonResult.success) {
        throw new Error(jsonResult.error || "Tizim tahlil qila olmadi. Iltimos qaytadan urinib ko'ring.");
      }

      const extractedData = jsonResult.data as DocumentAnalysisData;
      setAnalysisResult(extractedData);
      setModelUsedResult(jsonResult.modelUsed || "AI Engine");
      setSystemWarnings(jsonResult.warnings || []);
      
      // Save record in localStorage history
      const imagePayload = uploadedImages.map(img => img.thumbnail || img.base64);
      saveRecordToHistory(extractedData, imagePayload, jsonResult.modelUsed || "AI Engine");

    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "Tanish xatosi yuz berdi. Internetni tekshirib ko'ring.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Statistics calculation helper
  const stats = {
    total: history.length,
    deportBor: history.filter(h => h.data.has_deport === true).length,
    deportYoq: history.filter(h => h.data.has_deport === false).length
  };

  // Copy result card as structured textual data to Clipboard
  const copyToClipboard = () => {
    if (!analysisResult) return;
    
    const r = analysisResult;
    const textOutput = `
🚫 TEKSHIRAMIZ AI NATIJASI
─────────────────────────────────
👤 FIO: ${r.name_latin || "Noma'lum"} (${r.name_cyrillic || "Noma'lum"})
🎂 T/S: ${r.birth_date || "Noma'lum"}
🌍 Fuqarolik: ${r.citizenship || "Noma'lum"}
─────────────────────────────────
❌ Holat: ${r.has_deport ? "DEPORT BOR 🔴" : "DEPORT YO'Q 🟢"}
📋 Sabab/Modda: ${r.article || "Ko'rsatilmagan"}
📅 Qaror sanasi: ${r.decision_date || "Noma'lum"}
🔓 Ochiladi (Muddati): ${r.ban_end || "Noma'lum / Ma'lumot yo'q"}
📌 Qaror Turi: ${r.decision_type || "Noma'lum"}
─────────────────────────────────
🏛 Idora: ${r.department || "Ko'rsatilmagan"}
📌 Status: ${r.status || "Noma'lum"}
💻 Kod: ${r.record_code || "Noma'lum"}

Tizim xulosasi (Uz):
${r.summary_uz || "Xulosa mavjud emas."}
    `.trim();

    navigator.clipboard.writeText(textOutput)
      .then(() => {
        setCopiedState(true);
        setTimeout(() => setCopiedState(false), 2000);
      })
      .catch(err => {
        console.error("Fails to copy:", err);
      });
  };

  // Download the analysis result card as an image
  const downloadAsImage = () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    
    // We adjust parameters to make sure the target node's styling is preserved beautifully.
    toPng(cardRef.current, {
      cacheBust: true,
      backgroundColor: "#ffffff",
      style: {
        transform: "scale(1)",
        borderRadius: "0px",
      },
      quality: 0.98,
      pixelRatio: 2, // 2x density for visual crispness
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        const namePart = analysisResult?.name_latin?.replace(/\s+/g, "_") || "Hujjat_Tahlili";
        link.download = `${namePart}_TEKSHIRAMIZ_AI.png`;
        link.href = dataUrl;
        link.click();
        setIsExporting(false);
      })
      .catch((err) => {
        console.error("Tasvirga o'tkazishda xatolik yuz berdi:", err);
        setIsExporting(false);
      });
  };

  // Standard Printer execution of the warning card or print receipt
  const printFriendlyCard = () => {
    window.print();
  };

  // Select a past item from history to view in active card
  const selectHistoryItem = (item: HistoryRecord) => {
    setAnalysisResult(item.data);
    setModelUsedResult(item.modelUsed);
    setSystemWarnings([]);
    // Update active thumbnails so user can recognize which images correspond
    setUploadedImages(item.rawImages.map((img, i) => ({
      base64: img,
      name: `Tarixiy rasm #${i + 1}`,
      mimeType: "image/jpeg"
    })));
  };

  // Fitering search history records
  const filteredHistory = history.filter(record => {
    const query = searchQuery.toLowerCase();
    return (
      record.data.name_latin.toLowerCase().includes(query) ||
      record.data.name_cyrillic.toLowerCase().includes(query) ||
      record.data.citizenship.toLowerCase().includes(query) ||
      record.data.article.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans selection:bg-purple-200 pb-20 relative overflow-x-hidden">
      {/* Background Ambient Decorative Lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[-10%] w-[40%] h-[50%] bg-emerald-400/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] bg-purple-400/5 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="border-b border-slate-200 bg-white/70 backdrop-blur-md sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-rose-500 via-amber-400 to-emerald-500 rounded-xl font-display text-white shadow-md flex justify-center items-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black font-display tracking-wider bg-gradient-to-r from-rose-600 via-amber-500 to-emerald-600 bg-clip-text text-transparent">
                TEKSHIRAMIZ AI
              </h1>
              <p className="text-xs text-slate-500 font-mono tracking-tight font-medium">
                Migrant hujjatlarini tahlil qilish tizimi
              </p>
            </div>
          </div>

          {/* Model toggle switcher & API Keys settings */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-xs font-mono text-slate-500 px-2 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-600" /> AI Engine:
              </span>
              <button
                id="model_gemini"
                onClick={() => setPreferredModel("gemini")}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-300 flex items-center gap-1 cursor-pointer ${
                  preferredModel === "gemini"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-100"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Google Gemini
              </button>
              <button
                id="model_claude"
                onClick={() => setPreferredModel("anthropic")}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-300 flex items-center gap-1 cursor-pointer ${
                  preferredModel === "anthropic"
                    ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md shadow-rose-100"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Claude 3.5
              </button>
            </div>

            {/* Custom Keys Trigger */}
            <button
              onClick={() => setShowSettings(true)}
              className={`p-2 py-1.5 sm:px-3 rounded-xl border transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer text-xs font-semibold ${
                userGeminiKey || userAnthropicKey
                  ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
              title="Shaxsiy API kalitlarni sozlash"
            >
              <Settings className={`w-4 h-4 ${userGeminiKey || userAnthropicKey ? "text-emerald-600 duration-1000" : "text-slate-500"}`} />
              <span className="hidden sm:inline">Kalitlar Sozlamalari</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Application Container */}
      <main className="max-w-7xl mx-auto px-4 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Statistics Widgets Row */}
        <section className="lg:col-span-12 grid grid-cols-3 gap-4 no-print">
          {/* Total Checked */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300/60">
            <div>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-tight">Jami tekshirildi</p>
              <h3 className="text-xl sm:text-3xl font-bold font-display text-slate-800 mt-1">{stats.total} ta</h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
          </div>

          {/* Active deportations count */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300/60">
            <div>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-tight">Taqiq (DEPORT BOR) ❌</p>
              <h3 className="text-xl sm:text-3xl font-bold font-display text-red-600 mt-1">{stats.deportBor} ta</h3>
            </div>
            <div className="p-3 bg-red-50 text-red-500 rounded-xl border border-red-100">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>

          {/* Decent/Correct count */}
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl flex items-center justify-between shadow-sm transition-all duration-300 hover:shadow-md hover:border-slate-300/60">
            <div>
              <p className="text-xs font-mono text-slate-400 uppercase tracking-tight">Taqiq yo'q (TOZA) ✅</p>
              <h3 className="text-xl sm:text-3xl font-bold font-display text-emerald-600 mt-1">{stats.deportYoq} ta</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </section>

        {/* WORKSPACE LEFT: Image uploading & model execution (col span 7) */}
        <div className="lg:col-span-7 flex flex-col gap-6 no-print">
          
          <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm relative overflow-hidden">
            <h2 className="text-lg font-bold font-sans text-slate-800 flex items-center gap-2 mb-4">
              <Upload className="w-5 h-5 text-purple-600" />
              Hujjatlarni yuklash
            </h2>
            
            {/* DRAG & DROP ZONE */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 relative group flex flex-col items-center justify-center min-h-[220px] ${
                isDragging 
                  ? "border-purple-500 bg-purple-50/50 shadow-sm" 
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={fileSelected}
                className="hidden"
              />

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl mb-4 group-hover:scale-105 transition-all duration-300">
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-purple-600 transition-colors" />
              </div>

              <h4 className="text-sm font-semibold text-slate-700">
                Immigratsiya hujjati, qaror yoki bildirishnomalarni bu yerga tashlang!
              </h4>
              <p className="text-xs text-slate-500 font-mono mt-2">
                Skanerlangan rasm, fotosurat (.png, .jpg, .jpeg) — Maksimal 4 ta rasm
              </p>
              
              <div className="mt-4 px-4 py-1.5 bg-slate-100 text-[11px] text-slate-600 border border-slate-200/80 rounded-full font-mono">
                Click or Drop files
              </div>
            </div>

            {/* PREVIEW THUMBNAILS */}
            {uploadedImages.length > 0 && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-mono tracking-wider uppercase text-slate-500 bg-slate-100 px-2.5 py-1 rounded">
                    Yuklangan hujjatlar ({uploadedImages.length}/4)
                  </h4>
                  <button 
                    onClick={() => setUploadedImages([])}
                    className="text-[11px] text-red-600 hover:text-red-500 transition-colors flex items-center gap-1 font-mono font-semibold"
                  >
                    Tozalash
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <AnimatePresence>
                    {uploadedImages.map((img, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="relative aspect-[3/4] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group shadow-sm"
                      >
                        <img 
                          src={img.base64} 
                          alt={img.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                          <p className="text-[9px] text-slate-200 font-mono truncate absolute top-1 left-1 right-1 px-1">
                            {img.name}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeThumbnail(index);
                            }}
                            className="p-1.5 bg-red-600 rounded-lg hover:bg-red-500 text-white transition-colors cursor-pointer"
                            title="Rasm o'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* ERROR DISPLAY */}
            {errorStatus && (
              <div className="mt-4 p-4 border border-red-200 bg-red-50 text-red-800 rounded-2xl text-xs sm:text-sm font-sans flex items-start gap-2.5 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Xatolik yuz berdi:</h4>
                  <p className="mt-0.5 text-slate-700">{errorStatus}</p>
                </div>
              </div>
            )}

            {/* MODEL EXECUTE TRIGGER ACTION */}
            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <button
                onClick={executeAnalysis}
                disabled={isAnalyzing || uploadedImages.length === 0}
                className={`w-full py-4 px-6 rounded-2xl font-display font-bold text-sm tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-md ${
                  isAnalyzing
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                    : uploadedImages.length === 0
                    ? "bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200/60"
                    : "bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white cursor-pointer active:scale-98 shadow-indigo-100 hover:shadow-lg hover:shadow-indigo-200"
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                    <span>Hujjat tahlil qilinmoqda...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <span>Deportni Aniqlash (AI)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* DYNAMIC PROGRESS ACCENT LOADER */}
          <AnimatePresence>
            {isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-200 p-5 rounded-2xl text-center shadow-sm relative overflow-hidden"
              >
                {/* Horizontal scanner beam animation */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse"></div>
                <div className="flex flex-col items-center">
                  <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-2.5" />
                  <p className="text-sm text-slate-700 font-mono tracking-tight">{loadingMessage}</p>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">
                    Bu ish hujjat sifatiga qarab 10–30 soniya vaqt olishi mumkin
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HISTORIC CHECKS MODULE: SEARCH AND RECORD TILES */}
          <div className="bg-white border border-slate-200/80 p-6 sm:p-8 rounded-3xl shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-base font-bold font-sans text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                Oxirgi tekshiruvlar tarixi
              </h2>
              {history.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  className="text-xs text-red-600 hover:text-red-500 transition-colors font-mono font-semibold cursor-pointer"
                >
                  Tarixni tozalash
                </button>
              )}
            </div>

            {/* SEARCH */}
            <div className="relative mb-4">
              <Search className="absolute top-1/2 left-3.5 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="FIO, davlat yoki modda bo'yicha qidirish..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-purple-500 focus:bg-white focus:ring-1 focus:ring-purple-500 transition-all font-sans"
              />
            </div>

            {/* ITEMS LIST */}
            {filteredHistory.length === 0 ? (
              <div className="p-8 border border-slate-200 border-dashed rounded-2xl text-center text-slate-400">
                <History className="w-8 h-8 mx-auto text-slate-350 mb-2" />
                <p className="text-xs font-mono">Tarixiy tekshiruvlar mavjud emas.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredHistory.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => selectHistoryItem(rec)}
                    className="p-3 bg-slate-50/50 hover:bg-slate-55 border border-slate-100 hover:border-slate-250 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 truncate">
                      {/* Color coded status dot */}
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        rec.data.has_deport ? "bg-red-500" : "bg-emerald-500"
                      }`} />
                      
                      <div className="truncate">
                        <h4 className="text-sm font-semibold text-slate-700 truncate group-hover:text-purple-600 transition-colors">
                          {rec.data.name_latin || "Noma'lum shaxs"}
                        </h4>
                        <p className="text-[10px] text-slate-550 font-mono flex items-center gap-2 mt-0.5">
                          <span>{rec.data.birth_date}</span>
                          <span>•</span>
                          <span>{rec.data.citizenship}</span>
                          <span>•</span>
                          <span className="text-slate-400">{rec.timestamp}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                        rec.data.has_deport 
                          ? "bg-red-50 text-red-600 border-red-100" 
                          : "bg-emerald-50 text-emerald-600 border-emerald-100"
                      }`}>
                        {rec.data.has_deport ? "DEPORT" : "TOZA"}
                      </span>
                      
                      <button
                        onClick={(e) => deleteHistoryItem(rec.id, e)}
                        className="p-1 px-1.5 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* WORKSPACE RIGHT: Warning Card Result Panel (col span 5) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {!analysisResult && !isAnalyzing ? (
              /* EMPTY PRE-ANALYSIS STATE VIEW */
              <motion.div
                key="empty_state"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200/80 p-8 rounded-3xl text-center shadow-sm flex flex-col items-center justify-center min-h-[400px] no-print"
              >
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-3xl text-slate-400 mb-4">
                  <ShieldAlert className="w-10 h-10 text-slate-500" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Tahlil natijasi kutilmoqda
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-2 max-w-sm mx-auto leading-relaxed">
                  Chap tomondagi yuklash darchasi orqali migrant fuqarolarning pasport, patent, yoki rasmiy sud qarori fotolarini joylang va "Deportni Aniqlash" tugmasini bosing.
                </p>

                {/* Guidelines quick helper */}
                <div className="mt-8 border-t border-slate-100 pt-6 w-full text-left">
                  <h4 className="text-[11px] font-mono text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-center gap-1.5 font-semibold">
                    <BookOpen className="w-3.5 h-3.5" /> QOIDALAR & YORDAM
                  </h4>
                  <ul className="text-xs text-slate-500 space-y-2 font-sans px-2">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">•</span>
                      <span>Rasm sifati yuqori va yozuvlar aniq ko'ringan bo'lishi lozim.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">•</span>
                      <span>MDH va RF migratsiya idoralarining taqiq yoki deport xatlarini ham aniqlaydi.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">•</span>
                      <span>Xulosalar o'zbek tili moddasida beriladi.</span>
                    </li>
                  </ul>
                </div>
              </motion.div>
            ) : isAnalyzing ? (
              /* ACTIVE SCANNING ANALYZING VIEW */
              <motion.div
                key="loading_state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white border border-slate-200/80 p-8 rounded-3xl text-center shadow-sm flex flex-col items-center justify-center min-h-[400px] no-print"
              >
                <div className="relative w-28 h-28 mb-6">
                  {/* Decorative rotating progress rings */}
                  <div className="absolute inset-0 rounded-full border-4 border-slate-150"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
                  <div className="absolute inset-2 rounded-full border-2 border-slate-50 border-b-transparent animate-spin duration-700"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-purple-600">
                    <Activity className="w-8 h-8 animate-pulse" />
                  </div>
                </div>

                <div className="h-2 w-48 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse w-[75%]"></div>
                </div>

                <h3 className="text-base font-bold text-slate-800 font-display">
                  Skajner tahlil qilmoqda...
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-1.5">
                  Anthropic Claude & Google GenAI parallel tekshiruvi.
                </p>
                
                <div className="mt-8 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl w-full text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-emerald-600 animate-spin" />
                    <span className="text-xs font-mono text-slate-600 font-bold">Tizim holati:</span>
                  </div>
                  <p className="text-[11px] text-slate-550 font-sans leading-relaxed">
                    Surat tushunish, ism transliteratsiyasi va modda qonuniyligi tahlillari davom etmoqda...
                  </p>
                </div>
              </motion.div>
            ) : (
              /* REAL TIME STYLIZED YELLOW-RED DEPORT CARDS OR GREEN SAFE CARDS */
              <motion.div
                key="result_state"
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="flex flex-col gap-4"
              >
                {/* Visualizer Warning Layout - Official White Paper styling */}
                <div 
                  id="deport_warning_card"
                  ref={cardRef}
                  className="border border-slate-300 rounded-2xl p-6 sm:p-8 print-card bg-white text-slate-900 font-sans shadow-md"
                >

                  {/* IDENTIFICATION BLOCK */}
                  <div className="space-y-4 text-xs sm:text-sm">
                    {/* FULL NAME */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-500 font-mono block text-[10px] uppercase tracking-wider">Ф.И.О. (ЛОТИН АЛИФБОСИДА)</span>
                      <strong className="text-slate-900 font-display text-base sm:text-lg font-bold leading-tight block mt-0.5">
                        {analysisResult?.name_latin || "МАЪЛУМОТ ТОПИЛМАДИ"}
                      </strong>
                      {analysisResult?.name_cyrillic && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 text-slate-600 text-xs font-medium">
                          КИРИЛЛ АЛИФБОСИДАГИ ЁЗУВИ: <span className="font-mono bg-slate-200/50 px-1.5 py-0.5 rounded text-slate-800 font-bold">{analysisResult.name_cyrillic}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* BIRTH DATE */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-mono block text-[10px] uppercase tracking-wider">ТУҒИЛГАН САНАСИ:</span>
                        <span className="text-slate-900 font-mono font-bold text-sm block mt-0.5">
                          {analysisResult?.birth_date || "МАЪЛУМОТ ЙЎҚ"}
                        </span>
                      </div>

                      {/* CITIZENSHIP */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-mono block text-[10px] uppercase tracking-wider">ФУҚАРОЛИГИ:</span>
                        <span className="text-slate-900 font-mono font-bold text-sm block mt-0.5">
                          {analysisResult?.citizenship || "МАЪЛУМОТ ЙЎҚ"}
                        </span>
                      </div>
                    </div>

                    {/* SABAB ARTICLE */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                      <span className="text-slate-500 font-mono block text-[10px] uppercase tracking-wider">БУЗИЛГАН ҚОНУН МОДДАСИ (АСОСИ):</span>
                      <span className="text-slate-900 font-mono font-bold text-sm block mt-0.5">
                        {analysisResult?.article || "ҚОНУНИЙ МОДДА КЎРСАТИЛМАГАН"}
                      </span>
                    </div>

                    {/* DATES GRID */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-mono block text-[10px] uppercase tracking-wider">ҚАРОР ҚАБУЛ ҚИЛИНГАН САНА:</span>
                        <span className="text-slate-900 font-mono font-medium block mt-0.5">
                          {analysisResult?.decision_date || "ЙЎҚ / КЎРСАТИЛМАГАН"}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-mono block text-[10px] uppercase tracking-wider">ТАҚИҚ ОЧИЛИШ САНАСИ:</span>
                        <span className="text-slate-900 font-mono font-bold block mt-0.5">
                          {analysisResult?.ban_end || "МАЪЛУМОТ ЙЎҚ"}
                        </span>
                      </div>
                    </div>

                    {/* INSTITUTION & STATUS DETAILS */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-500 font-mono block text-[10px] uppercase tracking-wider">ТАҚИҚ ҚЎЙГАН ВАЗИРЛИК/ИДОРА:</span>
                      <span className="text-slate-800 font-mono text-xs font-semibold leading-tight block mt-0.5">
                        {analysisResult?.department || "МАЪЛУМОТ КЎРСАТИЛМАГАН"}
                      </span>
                    </div>

                    {/* FINAL DECISION TYPE & SYSTEM DIRECT STATUS */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-mono block text-[10px] uppercase tracking-wider">ҚАРОР ТУРИ:</span>
                        <span className="text-slate-900 font-medium block mt-0.5 text-xs sm:text-sm">
                          {analysisResult?.decision_type || "КИРИШНИ ТАҚИҚЛАШ"}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-mono block text-[10px] uppercase tracking-wider">ЖОРИЙ ҲОЛАТИ:</span>
                        <span className="block text-xs font-mono font-bold uppercase mt-1 text-slate-900">
                          {analysisResult?.status === "Active" ? "ФАОЛ (ТАҚИҚ КУЧДА)" : "ФАОЛ ЭМАС (ТАҚИҚ МУДДАТИ ТУГАГАН)"}
                        </span>
                      </div>
                    </div>

                    {/* UZBEK LANGUAGE SUMMARY TEXT - HIGHLY OFFICIAL WHITE PAPER DESIGN */}
                    <div className="mt-4 p-4.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs leading-relaxed font-sans shadow-sm">
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold mb-1.5 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-600" /> БАТАФСИЛ РАСМИЙ ХУЛОСА:
                      </p>
                      <div className="text-slate-700 font-medium whitespace-pre-line text-[13px] border-t border-slate-200 pt-2 leading-relaxed">
                        {analysisResult?.summary_uz}
                      </div>
                    </div>
                  </div>
                </div>

                {/* API SYSTEM WARNINGS fallback notices if required */}
                {systemWarnings.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px] font-mono flex items-start gap-1.5 no-print shadow-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 font-bold" />
                    <div className="leading-relaxed">
                      {systemWarnings.map((warn, i) => <p key={i}>{warn}</p>)}
                    </div>
                  </div>
                )}

                {/* WARNING CARD CONTROLS ACTIONS: COPY & DOWNLOAD IMAGE */}
                <div className="flex flex-col sm:flex-row gap-3 no-print mt-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex-1 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                  >
                    {copiedState ? (
                      <>
                        <Check className="w-5 h-5 text-emerald-600 animate-bounce" />
                        <span className="text-emerald-700">ҲУЖЖАТДАН НУСХА ОЛИНДИ!</span>
                      </>
                    ) : (
                      <>
                        <Clipboard className="w-5 h-5 text-slate-500" />
                        <span>ХУЛОСАНИ КЎЧИРИБ ОЛИШ (НУСХА КЎЧИРИШ)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={downloadAsImage}
                    disabled={isExporting}
                    className="flex-1 py-3.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 transition-all"
                  >
                    {isExporting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>РАСМГА АЙЛАНТИРИЛМОҚДА...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-5 h-5 text-purple-200" />
                        <span>РАСМ СИФАТИДА ЮКЛАБ ОЛИШ</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Settings Modal for Custom API Keys */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white w-full max-w-md rounded-2xl border border-slate-200/80 p-6 shadow-xl relative text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">API Kalitlar Sozlamalari</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Shaxsiy API kalitingizdan foydalanish</p>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="ml-auto w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Loyihani GitHub yoki Netlify-ga yuklaganingizda shaxsiy API kalitingizdan foydalanishingiz mumkin. Kalitlar serverda saqlanmaydi, faqatgina ushbu brauzerda (localStorage) xavfsiz saqlanadi.
                </p>

                {/* Gemini API Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <span>Google Gemini API Key</span>
                    </label>
                    {userGeminiKey ? (
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-mono border border-emerald-200 font-semibold">KIRITILGAN</span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono">TIZIMNIKI</span>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={userGeminiKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserGeminiKey(val);
                      localStorage.setItem("user_gemini_api_key", val);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl text-xs font-mono outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Gemini modelidan foydalanish uchun. Kalitni <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline font-medium">Google AI Studio</a>-dan olishingiz mumkin.
                  </p>
                </div>

                {/* Anthropic API Key */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                      <span>Anthropic Claude API Key</span>
                    </label>
                    {userAnthropicKey ? (
                      <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-mono border border-emerald-200 font-semibold">KIRITILGAN</span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-mono">TIZIMNIKI</span>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="sk-ant-api03-..."
                    value={userAnthropicKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserAnthropicKey(val);
                      localStorage.setItem("user_anthropic_api_key", val);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl text-xs font-mono outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Claude 3.5 modelidan foydalanish uchun. Kalitni <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline font-medium">Anthropic Console</a>-dan olishingiz mumkin.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3 border-t border-slate-100 pt-4">
                {(userGeminiKey || userAnthropicKey) && (
                  <button
                    onClick={() => {
                      setUserGeminiKey("");
                      setUserAnthropicKey("");
                      localStorage.removeItem("user_gemini_api_key");
                      localStorage.removeItem("user_anthropic_api_key");
                    }}
                    className="flex-1 py-2 px-3 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Kalitlarni Tozalash
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowSettings(false);
                  }}
                  className="flex-1 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer text-center"
                >
                  Saqlash va Yopish
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER SECTION */}
      <footer className="mt-24 border-t border-slate-200/80 pt-8 pb-12 text-center text-xs text-slate-400 font-mono no-print">
        <p>© 2026 TEKSHIRAMIZ AI. Barcha huquqlar himoyalangan.</p>
        <p className="mt-1 flex items-center justify-center gap-1 text-slate-300 text-[10px]">
          Google Generative AI Hub & Cloud Sonnet 3.5 Integratsiyasi
        </p>
      </footer>
    </div>
  );
}
