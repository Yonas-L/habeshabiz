import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2, Upload, Sliders, RefreshCw, Stamp as StampIcon, Eraser, RotateCcw, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';

interface StampProcessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (url: string) => void;
  title?: string;
}

export const StampProcessorModal: React.FC<StampProcessorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  title = 'Official Company Stamp & Seal',
}) => {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);

  // Filter settings
  const [tolerance, setTolerance] = useState<number>(35); // Aggressive paper background removal (5 - 80)
  const [smoothness, setSmoothness] = useState<number>(12); // Alpha edge feathering (2 - 30)
  const [opacity, setOpacity] = useState<number>(100); // Stamp opacity / transparency (25 - 100)
  const [contrastBoost, setContrastBoost] = useState<boolean>(true);
  const [inkTint, setInkTint] = useState<'original' | 'red' | 'blue' | 'black'>('original');

  // Interactive Eraser Brush tool state
  const [brushSize, setBrushSize] = useState<number>(28);
  const [isErasing, setIsErasing] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load image from file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setSourceImage(img);
        setUndoStack([]);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Re-process image whenever filters change
  const processImage = useCallback(() => {
    if (!sourceImage || !previewCanvasRef.current) return;
    setIsProcessing(true);

    try {
      const canvas = previewCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Downscale if too large to keep processing snappy (max 900px)
      const maxDim = 850;
      let width = sourceImage.naturalWidth;
      let height = sourceImage.naturalHeight;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(sourceImage, 0, 0, width, height);

      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // 1. Establish baseline paper tone by sampling corners
      let cornerLumSum = 0;
      let cornerCount = 0;
      const cornerSize = Math.max(4, Math.min(18, Math.floor(width / 12), Math.floor(height / 12)));
      const corners = [
        [0, 0],
        [0, width - cornerSize],
        [height - cornerSize, 0],
        [height - cornerSize, width - cornerSize],
      ];

      for (const [cy, cx] of corners) {
        for (let dy = 0; dy < cornerSize; dy++) {
          for (let dx = 0; dx < cornerSize; dx++) {
            const idx = ((cy + dy) * width + (cx + dx)) * 4;
            cornerLumSum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            cornerCount++;
          }
        }
      }

      const baselinePaperLum = cornerCount > 0 ? cornerLumSum / cornerCount : 230;
      // Adaptive paper threshold: shifts with tolerance and detected paper background
      const baseThreshold = Math.min(248, baselinePaperLum - (tolerance / 100) * 85);
      const featherRange = Math.max(1, smoothness);

      // Desired ink tint RGB
      let targetR = 0, targetG = 0, targetB = 0;
      if (inkTint === 'red') { targetR = 210; targetG = 30; targetB = 40; }
      else if (inkTint === 'blue') { targetR = 25; targetG = 75; targetB = 200; }
      else if (inkTint === 'black') { targetR = 25; targetG = 25; targetB = 30; }

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) continue;

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const chroma = maxC - minC;

        // Stamp ink characteristics:
        // Blue / violet ink has blue prominence:
        const isBlueInk = (b - r > 10 && b - g > 4) || (b > 85 && chroma > 16);
        // Red / magenta ink has red prominence:
        const isRedInk = (r - g > 15 && r - b > 10) || (r > 105 && chroma > 18);
        // Dark ink text (black ink):
        const isDarkInk = lum < 105 && chroma < 22;

        // Paper or shadow is neutral (low saturation):
        const isNeutralBackground = chroma < 18;

        let alphaVal = 0;

        if (isBlueInk || isRedInk) {
          // Strongly retain ink details while fading faint paper residue
          if (lum < baseThreshold + 15) {
            alphaVal = 255;
          } else {
            const diff = (baseThreshold + 15) - lum;
            alphaVal = Math.max(0, Math.round(255 * (1 + diff / featherRange)));
          }
        } else if (isDarkInk) {
          alphaVal = Math.min(255, Math.round((1 - lum / 125) * 255));
        } else if (isNeutralBackground) {
          // Paper shadows / folds: if neutral and above shadow cutoff, completely transparent!
          const shadowCutoff = Math.max(85, baseThreshold - (tolerance / 100) * 45);
          if (lum >= shadowCutoff) {
            alphaVal = 0;
          } else {
            alphaVal = Math.max(0, Math.round(((shadowCutoff - lum) / featherRange) * 160));
          }
        } else {
          // Generic boundary
          if (lum >= baseThreshold) {
            alphaVal = 0;
          } else if (lum > baseThreshold - featherRange) {
            const ratio = (baseThreshold - lum) / featherRange;
            alphaVal = Math.round(a * Math.pow(ratio, 1.2));
          } else {
            alphaVal = 255;
          }
        }

        if (alphaVal <= 8) {
          data[i + 3] = 0;
          continue;
        }

        if (contrastBoost) {
          alphaVal = Math.min(255, Math.round(alphaVal * 1.25));
        }

        // Apply opacity factor
        alphaVal = Math.round(alphaVal * (opacity / 100));
        data[i + 3] = alphaVal;

        // Apply tint recoloring if chosen
        if (inkTint !== 'original' && alphaVal > 15) {
          const darknessFactor = 1 - (lum / 255);
          data[i] = Math.round(targetR * darknessFactor + (1 - darknessFactor) * 20);
          data[i + 1] = Math.round(targetG * darknessFactor + (1 - darknessFactor) * 20);
          data[i + 2] = Math.round(targetB * darknessFactor + (1 - darknessFactor) * 20);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    } finally {
      setIsProcessing(false);
    }
  }, [sourceImage, tolerance, smoothness, contrastBoost, inkTint, opacity]);

  useEffect(() => {
    if (sourceImage) {
      processImage();
    }
  }, [sourceImage, processImage]);

  // Save state before brushing for Undo
  const saveUndoState = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => [...prev.slice(-10), current]);
  };

  const handleUndo = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || undoStack.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newStack = [...undoStack];
    const prev = newStack.pop();
    if (prev) {
      ctx.putImageData(prev, 0, 0);
    }
    setUndoStack(newStack);
  };

  // Convert mouse / pointer coordinate to canvas physical coordinates
  const getCanvasPhysicalCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return { x: 0, y: 0, cssX: 0, cssY: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      cssX: e.clientX - rect.left,
      cssY: e.clientY - rect.top,
    };
  };

  // Erase pixels around (canvasX, canvasY)
  const eraseAt = (canvasX: number, canvasY: number) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, brushSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!sourceImage) return;
    e.preventDefault();
    saveUndoState();
    setIsErasing(true);
    const coords = getCanvasPhysicalCoords(e);
    eraseAt(coords.x, coords.y);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasPhysicalCoords(e);
    setCursorPos({ x: coords.cssX, y: coords.cssY, visible: true });

    if (!isErasing) return;
    e.preventDefault();
    eraseAt(coords.x, coords.y);
  };

  const handleCanvasPointerUp = () => {
    setIsErasing(false);
  };

  // 1-Click Clean Outer Margins (cleans outer 4% borders from shadows/vignette)
  const handleCleanMargins = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveUndoState();

    const w = canvas.width;
    const h = canvas.height;
    const marginX = Math.round(w * 0.04);
    const marginY = Math.round(h * 0.04);

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    // Top
    ctx.fillRect(0, 0, w, marginY);
    // Bottom
    ctx.fillRect(0, h - marginY, w, marginY);
    // Left
    ctx.fillRect(0, 0, marginX, h);
    // Right
    ctx.fillRect(w - marginX, 0, marginX, h);
    ctx.restore();

    toast.success('Outer borders cleaned');
  };

  // Tight crop around stamp
  const getCleanCroppedDataUrl = (): string | null => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 25) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return canvas.toDataURL('image/png');

    const padding = 12;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropWidth = Math.min(width - cropX, (maxX - minX) + padding * 2);
    const cropHeight = Math.min(height - cropY, (maxY - minY) + padding * 2);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropWidth;
    cropCanvas.height = cropHeight;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) return canvas.toDataURL('image/png');

    cropCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return cropCanvas.toDataURL('image/png');
  };

  const handleSave = async () => {
    if (!sourceImage) {
      toast.error('Please upload an image first.');
      return;
    }

    const cleanBase64 = getCleanCroppedDataUrl();
    if (!cleanBase64) {
      toast.error('Failed to export cleaned stamp.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await api.saveStamp(cleanBase64);
      toast.success('Official transparent stamp saved successfully');
      onSaved(res.stamp_url);
      onClose();
    } catch (err: any) {
      toast.error('Failed to save stamp', { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#131926] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <StampIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
              <p className="text-[11px] text-slate-400">Intelligent background isolation, paper shadow suppression & edge cleaning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {!sourceImage ? (
            /* Upload Prompt */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-64 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50/50 dark:bg-slate-900/40 p-6 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform border border-emerald-500/20">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-slate-900 dark:text-white">Upload Stamp or Seal Photo</div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Upload a photo of your stamp on paper. Our AI engine wipes away paper shadows and texture, and gives you a brush to clean any edge smudges.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                Supports PNG, JPG, WebP
              </span>
            </div>
          ) : (
            /* Image Processing Studio */
            <div className="space-y-3.5">
              {/* Interactive Preview Canvas with Brush Eraser */}
              <div className="relative w-full h-64 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-[repeating-conic-gradient(#e2e8f0_0%_25%,#f8fafc_0%_50%)] dark:bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] [background-size:16px_16px] overflow-hidden flex items-center justify-center shadow-inner cursor-crosshair">
                <canvas
                  ref={previewCanvasRef}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerLeave={() => {
                    handleCanvasPointerUp();
                    setCursorPos((prev) => ({ ...prev, visible: false }));
                  }}
                  className="max-w-full max-h-full object-contain filter drop-shadow-sm select-none touch-none"
                />

                {/* Floating Brush Cursor Circle */}
                {cursorPos.visible && (
                  <div
                    className="pointer-events-none absolute rounded-full border-2 border-emerald-500 bg-emerald-500/20 -translate-x-1/2 -translate-y-1/2 transition-none"
                    style={{
                      left: `${cursorPos.x}px`,
                      top: `${cursorPos.y}px`,
                      width: `${brushSize * 1.5}px`,
                      height: `${brushSize * 1.5}px`,
                    }}
                  />
                )}

                {/* Quick Toolbar on Preview */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 p-1 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 backdrop-blur-xs">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Undo Brush Erase"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleCleanMargins}
                    className="px-2 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1"
                    title="Clean outer edge vignette/shadows"
                  >
                    <Scissors className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Clean Edges</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Change image file"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="absolute bottom-2 left-3 text-[10px] text-slate-500 dark:text-slate-400 font-mono select-none bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md backdrop-blur-xs">
                  Tip: Drag cursor over canvas to brush-clean paper edges
                </div>
              </div>

              {/* Eraser Brush Control Strip */}
              <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <Eraser className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-slate-900 dark:text-white text-[11px]">Edge Eraser Brush</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 mr-1">Brush Size:</span>
                  {[
                    { label: 'Fine', size: 14 },
                    { label: 'Medium', size: 28 },
                    { label: 'Broad', size: 52 },
                  ].map((s) => (
                    <button
                      key={s.size}
                      type="button"
                      onClick={() => setBrushSize(s.size)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                        brushSize === s.size
                          ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Adjustment Sliders & Controls */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Background Isolation & Ink Refinement</span>
                </div>

                {/* Tolerance slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">Paper Threshold (Tolerance)</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">{tolerance}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-full accent-emerald-600 dark:accent-emerald-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Gentle (Keep light lines)</span>
                    <span>Aggressive (Erase dark shadows)</span>
                  </div>
                </div>

                {/* Edge Smoothness */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">Edge Feathering (Smoothness)</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">{smoothness}px</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="30"
                    value={smoothness}
                    onChange={(e) => setSmoothness(Number(e.target.value))}
                    className="w-full accent-emerald-600 dark:accent-emerald-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Opacity slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">Stamp Ink Opacity (Transparency)</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">{opacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="25"
                    max="100"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="w-full accent-emerald-600 dark:accent-emerald-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Semi-transparent (Natural paper bleed)</span>
                    <span>Solid / Opaque</span>
                  </div>
                </div>

                {/* Ink Color Tint */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Stamp Ink Style:</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { key: 'original', label: 'Original' },
                      { key: 'red', label: 'Classic Red' },
                      { key: 'blue', label: 'Navy Blue' },
                      { key: 'black', label: 'Charcoal' },
                    ].map((mode) => (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => setInkTint(mode.key as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          inkTint === mode.key
                            ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contrast Boost Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Boost Ink Contrast:</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={contrastBoost}
                      onChange={(e) => setContrastBoost(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-500">Darken faint stamp impressions</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!sourceImage || isSaving || isProcessing}
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white dark:text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Save Official Stamp</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
