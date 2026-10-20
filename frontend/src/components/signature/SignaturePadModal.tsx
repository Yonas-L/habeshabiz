import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Eraser, Check, Loader2, PenTool, Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (url: string) => void;
  title?: string;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  title = 'Authorized Digital Signature',
}) => {
  const [tab, setTab] = useState<'draw' | 'upload'>('draw');
  const [inkColor, setInkColor] = useState<string>('#0f172a');
  const [strokeWidth, setStrokeWidth] = useState<number>(2.5);
  const [isSaving, setIsSaving] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);

  // File upload state
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize and scale canvas for high DPI displays
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth;

    // Reset history
    setHistory([]);
    setHasDrawn(false);
  }, [inkColor, strokeWidth]);

  useEffect(() => {
    if (isOpen && tab === 'draw') {
      // Small timeout to allow DOM to layout before taking getBoundingClientRect
      const timer = setTimeout(() => {
        initCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, tab, initCanvas]);

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-15), imageData]);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    const prevState = newHistory[newHistory.length - 1];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (prevState) {
      ctx.putImageData(prevState, 0, 0);
    } else {
      setHasDrawn(false);
    }
    setHistory(newHistory);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
    setHasDrawn(false);
  };

  const getCanvasCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveCanvasState();
    isDrawingRef.current = true;
    const coords = getCanvasCoordinates(e);
    lastPointRef.current = coords;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = inkColor;
    ctx.arc(coords.x, coords.y, Math.max(1, strokeWidth / 2), 0, Math.PI * 2);
    ctx.fill();

    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentCoords = getCanvasCoordinates(e);
    const lastCoords = lastPointRef.current;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth;
    ctx.moveTo(lastCoords.x, lastCoords.y);
    ctx.lineTo(currentCoords.x, currentCoords.y);
    ctx.stroke();

    lastPointRef.current = currentCoords;
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  // Trim canvas whitespace to crop tight around signature strokes
  const getTrimmedDataUrl = (): string | null => {
    const canvas = canvasRef.current;
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
        if (alpha > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return null;

    // Add padding around crop
    const padding = 15;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropWidth = Math.min(width - cropX, (maxX - minX) + padding * 2);
    const cropHeight = Math.min(height - cropY, (maxY - minY) + padding * 2);

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = cropWidth;
    trimmedCanvas.height = cropHeight;
    const trimmedCtx = trimmedCanvas.getContext('2d');
    if (!trimmedCtx) return canvas.toDataURL('image/png');

    trimmedCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return trimmedCanvas.toDataURL('image/png');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG/JPG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    let base64Image: string | null = null;

    if (tab === 'draw') {
      if (!hasDrawn) {
        toast.error('Please sign on the canvas before saving.');
        return;
      }
      base64Image = getTrimmedDataUrl();
    } else {
      if (!uploadedPreview) {
        toast.error('Please select an image file to upload.');
        return;
      }
      base64Image = uploadedPreview;
    }

    if (!base64Image) {
      toast.error('Unable to generate signature image.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await api.saveSignature(base64Image);
      toast.success('Signature saved successfully');
      onSaved(res.signature_url);
      onClose();
    } catch (err: any) {
      toast.error('Failed to save signature', { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#131926] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
              <p className="text-[11px] text-slate-400">Crisp, transparent vector-compatible digital signature</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 pt-2">
          <button
            type="button"
            onClick={() => setTab('draw')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              tab === 'draw'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Draw with Mouse / Touch</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              tab === 'upload'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Image File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {tab === 'draw' ? (
            <div className="space-y-3">
              {/* Controls bar */}
              <div className="flex items-center justify-between text-xs">
                {/* Ink color picker */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ink:</span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'Black', value: '#0f172a' },
                      { label: 'Navy', value: '#1e3a8a' },
                      { label: 'Blue', value: '#2563eb' },
                    ].map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setInkColor(c.value)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          inkColor === c.value ? 'scale-110 border-slate-900 dark:border-white shadow-xs' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                  </div>

                  <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>

                  {/* Stroke thickness */}
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Weight:</span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: 'Fine', val: 1.5 },
                      { label: 'Regular', val: 2.5 },
                      { label: 'Thick', val: 3.8 },
                    ].map((w) => (
                      <button
                        key={w.label}
                        type="button"
                        onClick={() => setStrokeWidth(w.val)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                          strokeWidth === w.val
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Undo / Clear actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Undo stroke"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={!hasDrawn}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    title="Clear signature pad"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Drawing Canvas Box with Baseline */}
              <div className="relative w-full h-56 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] overflow-hidden select-none touch-none shadow-inner">
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="w-full h-full cursor-crosshair relative z-10"
                />

                {/* Baseline Guide */}
                <div className="absolute bottom-10 left-8 right-8 pointer-events-none flex items-center gap-3">
                  <div className="flex-1 h-[1px] bg-slate-300 dark:bg-slate-700"></div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 select-none">Sign Here</span>
                  <div className="flex-1 h-[1px] bg-slate-300 dark:bg-slate-700"></div>
                </div>

                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-xs text-slate-400 font-medium">Use stylus, finger, or mouse cursor</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileUpload}
                className="hidden"
              />

              {uploadedPreview ? (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                  <div className="w-48 h-28 bg-[repeating-conic-gradient(#e2e8f0_0%_25%,#f8fafc_0%_50%)] dark:bg-[repeating-conic-gradient(#1e293b_0%_25%,#0f172a_0%_50%)] [background-size:16px_16px] rounded-lg p-2 flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-xs">
                    <img src={uploadedPreview} alt="Signature Preview" className="max-w-full max-h-full object-contain" />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                  >
                    Change Image
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-48 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/50 dark:bg-slate-900/40"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Click to upload scanned signature</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">PNG with transparent background recommended (Max 2MB)</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving || (tab === 'draw' ? !hasDrawn : !uploadedPreview)}
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Save Signature</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
