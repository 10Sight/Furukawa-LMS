import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Pen, 
  Crop, 
  Type, 
  RotateCcw, 
  Check, 
  X, 
  Download,
  Palette,
  Undo2,
  Trash2,
  Move,
  Plus
} from 'lucide-react';
import { getMediaUrl } from '@/utils/mediaUtils.js';

export default function ImageEditorModal({ 
  isOpen, 
  imageSrc, 
  onSave, 
  onClose,
  title = "Edit Image" 
}) {
  const [activeTool, setActiveTool] = useState('pen'); // 'pen' | 'crop' | 'text'
  const [color, setColor] = useState('#EF4444'); // Default red annotation color
  const [lineWidth, setLineWidth] = useState(3);
  const [textInput, setTextInput] = useState('');
  const [fontSize, setFontSize] = useState(22);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]);
  
  // Border Crop state: rectangle in canvas coordinate space { x, y, width, height }
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const cropDragRef = useRef(null);

  // Movable / Draggable text items on the canvas
  // Array of { id, text, x, y, color, fontSize }
  const [textItems, setTextItems] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Colors available for pen & text
  const colorOptions = [
    '#EF4444', // Red
    '#2563EB', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#000000', // Black
    '#FFFFFF'  // White
  ];

  // Initialize and load image onto canvas with robust fallback
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    let isCancelled = false;
    let objectUrl = null;

    const loadImg = async () => {
      const resolvedUrl = getMediaUrl(imageSrc);
      const img = new Image();

      const tryLoad = (src, useCrossOrigin) => {
        return new Promise((resolve, reject) => {
          if (useCrossOrigin && !src.startsWith('data:') && !src.startsWith('blob:')) {
            img.crossOrigin = 'anonymous';
          } else {
            img.removeAttribute('crossorigin');
          }
          img.onload = () => resolve(img);
          img.onerror = (err) => reject(err);
          img.src = src;
        });
      };

      try {
        if (!resolvedUrl.startsWith('data:') && !resolvedUrl.startsWith('blob:')) {
          try {
            const resp = await fetch(resolvedUrl);
            if (resp.ok) {
              const blob = await resp.blob();
              objectUrl = URL.createObjectURL(blob);
              await tryLoad(objectUrl, false);
            } else {
              throw new Error('Blob fetch failed: ' + resp.status);
            }
          } catch (fetchErr) {
            try {
              await tryLoad(resolvedUrl, true);
            } catch (crossErr) {
              await tryLoad(resolvedUrl, false);
            }
          }
        } else {
          await tryLoad(resolvedUrl, false);
        }

        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const maxW = 1000;
        const maxH = 650;
        let w = img.naturalWidth || img.width || 800;
        let h = img.naturalHeight || img.height || 600;

        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        canvas.width = w;
        canvas.height = h;

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        setHistory([canvas.toDataURL()]);
        setCropBox({ x: 0, y: 0, width: w, height: h });
        setTextItems([]);
        setSelectedTextId(null);
        setTextInput('');
      } catch (err) {
        console.warn('Failed to load image in ImageEditorModal:', err);
      }
    };

    loadImg();

    return () => {
      isCancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, imageSrc]);

  // Helper to save canvas snapshot for Undo
  const saveSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory((prev) => [...prev, canvas.toDataURL()]);
  };

  // Undo last action
  const handleUndo = () => {
    if (history.length <= 1) return;
    const newHist = history.slice(0, history.length - 1);
    const prevSnapshot = newHist[newHist.length - 1];
    setHistory(newHist);

    const img = new Image();
    img.src = prevSnapshot;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setCropBox({ x: 0, y: 0, width: img.width, height: img.height });
    };
  };

  // Reset to original
  const handleReset = () => {
    if (history.length === 0) return;
    const originalSnapshot = history[0];
    const img = new Image();
    img.src = originalSnapshot;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      setHistory([originalSnapshot]);
      setCropBox({ x: 0, y: 0, width: img.width, height: img.height });
      setTextItems([]);
      setSelectedTextId(null);
    };
  };

  // Coordinates helper taking scale into account (canvas coordinate space)
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  /* ─── Pen / Freehand Drawing ────────────────────────── */
  const handleCanvasMouseDown = (e) => {
    if (activeTool === 'pen') {
      const { x, y } = getCanvasCoords(e);
      const ctx = canvasRef.current.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsDrawing(true);
    } else if (activeTool === 'text') {
      // If clicked on empty area in text mode, deselect text
      setSelectedTextId(null);
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (activeTool === 'pen' && isDrawing) {
      const { x, y } = getCanvasCoords(e);
      const ctx = canvasRef.current.getContext('2d');
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleCanvasMouseUp = () => {
    if (activeTool === 'pen' && isDrawing) {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.closePath();
      setIsDrawing(false);
      saveSnapshot();
    }
  };

  /* ─── Border Cropping Management ────────────────────── */
  const handleCropMouseDown = (e, handleType) => {
    e.stopPropagation();
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    cropDragRef.current = {
      handleType,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: { ...cropBox },
      scaleX,
      scaleY,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    };
    setIsDraggingCrop(true);
  };

  useEffect(() => {
    const handleCropMouseMove = (e) => {
      if (!isDraggingCrop || !cropDragRef.current) return;
      const {
        handleType,
        startClientX,
        startClientY,
        startBox,
        scaleX,
        scaleY,
        canvasWidth,
        canvasHeight
      } = cropDragRef.current;

      const deltaX = (e.clientX - startClientX) * scaleX;
      const deltaY = (e.clientY - startClientY) * scaleY;

      let newX = startBox.x;
      let newY = startBox.y;
      let newW = startBox.width;
      let newH = startBox.height;

      const MIN_SIZE = 24;

      if (handleType === 'move') {
        newX = Math.max(0, Math.min(canvasWidth - startBox.width, startBox.x + deltaX));
        newY = Math.max(0, Math.min(canvasHeight - startBox.height, startBox.y + deltaY));
      } else {
        // Horizontal adjustments
        if (handleType.includes('e')) {
          newW = Math.max(MIN_SIZE, Math.min(canvasWidth - startBox.x, startBox.width + deltaX));
        }
        if (handleType.includes('w')) {
          const maxDeltaX = startBox.width - MIN_SIZE;
          const allowedDeltaX = Math.min(deltaX, maxDeltaX);
          newX = Math.max(0, startBox.x + allowedDeltaX);
          newW = startBox.width - (newX - startBox.x);
        }

        // Vertical adjustments
        if (handleType.includes('s')) {
          newH = Math.max(MIN_SIZE, Math.min(canvasHeight - startBox.y, startBox.height + deltaY));
        }
        if (handleType.includes('n')) {
          const maxDeltaY = startBox.height - MIN_SIZE;
          const allowedDeltaY = Math.min(deltaY, maxDeltaY);
          newY = Math.max(0, startBox.y + allowedDeltaY);
          newH = startBox.height - (newY - startBox.y);
        }
      }

      setCropBox({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH)
      });
    };

    const handleCropMouseUp = () => {
      if (isDraggingCrop) {
        setIsDraggingCrop(false);
        cropDragRef.current = null;
      }
    };

    if (isDraggingCrop) {
      window.addEventListener('mousemove', handleCropMouseMove);
      window.addEventListener('mouseup', handleCropMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleCropMouseMove);
      window.removeEventListener('mouseup', handleCropMouseUp);
    };
  }, [isDraggingCrop]);

  const applyCrop = () => {
    if (!cropBox) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const x = Math.max(0, Math.round(cropBox.x));
    const y = Math.max(0, Math.round(cropBox.y));
    const width = Math.min(canvas.width - x, Math.round(cropBox.width));
    const height = Math.min(canvas.height - y, Math.round(cropBox.height));

    if (width < 20 || height < 20) {
      alert('Selected crop area is too small.');
      return;
    }

    burnTextToCanvas();

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(tempCanvas, 0, 0);

    setCropBox({ x: 0, y: 0, width, height });
    setTextItems([]);
    setSelectedTextId(null);
    saveSnapshot();
  };

  const resetCropToFull = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCropBox({
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height
    });
  };

  /* ─── Movable Text Management ───────────────────────── */
  const handleAddText = () => {
    const textToAdd = textInput.trim() || 'Sample Text';
    const canvas = canvasRef.current;
    const initialX = canvas ? canvas.width / 2 - 80 : 50;
    const initialY = canvas ? canvas.height / 2 - 20 : 50;

    const newItem = {
      id: Date.now(),
      text: textToAdd,
      x: Math.max(20, initialX + (textItems.length * 15)),
      y: Math.max(20, initialY + (textItems.length * 15)),
      color: color,
      fontSize: fontSize
    };

    setTextItems((prev) => [...prev, newItem]);
    setSelectedTextId(newItem.id);
    setTextInput('');
  };

  const handleTextMouseDown = (e, item) => {
    e.stopPropagation();
    setSelectedTextId(item.id);
    setIsDraggingText(true);

    const coords = getCanvasCoords(e);
    dragOffsetRef.current = {
      x: coords.x - item.x,
      y: coords.y - item.y
    };
  };

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (!isDraggingText || selectedTextId === null) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const coords = getCanvasCoords(e);
      const newX = coords.x - dragOffsetRef.current.x;
      const newY = coords.y - dragOffsetRef.current.y;

      setTextItems((prev) =>
        prev.map((item) =>
          item.id === selectedTextId
            ? {
                ...item,
                x: Math.max(0, Math.min(canvas.width - 40, newX)),
                y: Math.max(0, Math.min(canvas.height - 20, newY))
              }
            : item
        )
      );
    };

    const handleWindowMouseUp = () => {
      if (isDraggingText) {
        setIsDraggingText(false);
      }
    };

    if (isDraggingText) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingText, selectedTextId]);

  const handleUpdateSelectedText = (field, val) => {
    if (!selectedTextId) return;
    setTextItems((prev) =>
      prev.map((item) => (item.id === selectedTextId ? { ...item, [field]: val } : item))
    );
  };

  const handleDeleteText = (id) => {
    setTextItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  const burnTextToCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || textItems.length === 0) return;
    const ctx = canvas.getContext('2d');

    textItems.forEach((item) => {
      ctx.font = `bold ${item.fontSize}px sans-serif`;
      ctx.textBaseline = 'top';

      const metrics = ctx.measureText(item.text);
      const textWidth = metrics.width;
      const textHeight = item.fontSize;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      const paddingX = 8;
      const paddingY = 4;
      const radius = 5;
      const rectX = item.x - paddingX;
      const rectY = item.y - paddingY;
      const rectW = textWidth + paddingX * 2;
      const rectH = textHeight + paddingY * 2;

      ctx.roundRect 
        ? ctx.roundRect(rectX, rectY, rectW, rectH, radius) 
        : ctx.rect(rectX, rectY, rectW, rectH);
      ctx.fill();

      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    });
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    burnTextToCanvas();

    const updatedDataUrl = canvas.toDataURL('image/png');
    onSave(updatedDataUrl);
    onClose();
  };

  if (!isOpen) return null;

  // Calculate crop screen position for overlay
  let screenCrop = null;
  if (canvasRef.current && cropBox && cropBox.width > 0 && cropBox.height > 0) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    screenCrop = {
      left: cropBox.x * scaleX,
      top: cropBox.y * scaleY,
      width: cropBox.width * scaleX,
      height: cropBox.height * scaleY
    };
  }

  const selectedTextObj = textItems.find((t) => t.id === selectedTextId);

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
              <Pen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-500">
                Annotate with Pen, Crop with border handles, or Add & Move text freely
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
              title="Undo last stroke or action"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer shadow-2xs"
              title="Reset to original image"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar Strip */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTool('pen')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTool === 'pen'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Pen className="w-3.5 h-3.5" />
              <span>Pen</span>
            </button>

            <button
              onClick={() => {
                setActiveTool('crop');
                if (canvasRef.current && (!cropBox || cropBox.width <= 0)) {
                  setCropBox({
                    x: 0,
                    y: 0,
                    width: canvasRef.current.width,
                    height: canvasRef.current.height
                  });
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTool === 'crop'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Crop</span>
            </button>

            <button
              onClick={() => setActiveTool('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTool === 'text'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Add Text</span>
            </button>
          </div>

          {/* Tool-specific controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Color Palette (for Pen & Text) */}
            {(activeTool === 'pen' || activeTool === 'text') && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-500">Color:</span>
                <div className="flex items-center gap-1">
                  {colorOptions.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setColor(c);
                        if (selectedTextId) {
                          handleUpdateSelectedText('color', c);
                        }
                      }}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-full border border-slate-300 transition-transform ${
                        color === c ? 'scale-125 ring-2 ring-blue-500 ring-offset-1' : 'hover:scale-110'
                      }`}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pen Stroke Width Slider */}
            {activeTool === 'pen' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-500">Thickness:</span>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                  className="w-20 accent-blue-600 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-700 w-4">{lineWidth}px</span>
              </div>
            )}

            {/* Text Input Control & Add Text Button */}
            {activeTool === 'text' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddText();
                    }
                  }}
                  placeholder="Type text to add..."
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white w-44"
                />
                <select
                  value={fontSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setFontSize(newSize);
                    if (selectedTextId) {
                      handleUpdateSelectedText('fontSize', newSize);
                    }
                  }}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="16">16px</option>
                  <option value="20">20px</option>
                  <option value="24">24px</option>
                  <option value="30">30px</option>
                  <option value="36">36px</option>
                </select>

                <button
                  type="button"
                  onClick={handleAddText}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Text</span>
                </button>
              </div>
            )}

            {/* Border Crop Action Buttons */}
            {activeTool === 'crop' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Drag borders or corners to crop:</span>
                <button
                  type="button"
                  onClick={applyCrop}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
                >
                  Apply Crop
                </button>
                <button
                  type="button"
                  onClick={resetCropToFull}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  title="Reset borders to full image"
                >
                  Reset Borders
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Selected text property floating bar (if user has selected a movable text) */}
        {selectedTextObj && (
          <div className="px-5 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900 animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="font-bold flex items-center gap-1 text-[11px]">
                <Move className="w-3.5 h-3.5" />
                Selected Text:
              </span>
              <input
                type="text"
                value={selectedTextObj.text}
                onChange={(e) => handleUpdateSelectedText('text', e.target.value)}
                className="bg-white border border-blue-200 rounded px-2 py-0.5 text-xs text-slate-800 outline-none w-48 font-medium"
              />
              <span className="text-[11px] text-blue-700">Drag text anywhere on image to reposition</span>
            </div>

            <button
              onClick={() => handleDeleteText(selectedTextObj.id)}
              className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-800 px-2 py-0.5 rounded hover:bg-rose-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Text</span>
            </button>
          </div>
        )}

        {/* Canvas Display Viewport */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-800/90 relative min-h-[350px] max-h-[65vh] select-none"
        >
          <div className="relative inline-block shadow-2xl rounded">
            {/* The Main Canvas */}
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              className={`max-w-full max-h-[60vh] object-contain rounded bg-white ${
                activeTool === 'pen' 
                  ? 'cursor-crosshair' 
                  : activeTool === 'crop' 
                  ? 'cursor-default' 
                  : 'cursor-default'
              }`}
            />

            {/* Border Cropping Visual Overlay with Handles */}
            {activeTool === 'crop' && screenCrop && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded">
                {/* 4 Dimmed Masks Outside Crop Box */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    right: 0,
                    height: `${screenCrop.top}px`,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: `${screenCrop.top + screenCrop.height}px`,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: `${screenCrop.top}px`,
                    width: `${screenCrop.left}px`,
                    height: `${screenCrop.height}px`,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${screenCrop.left + screenCrop.width}px`,
                    top: `${screenCrop.top}px`,
                    right: 0,
                    height: `${screenCrop.height}px`,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)'
                  }}
                />

                {/* The Interactive Crop Box */}
                <div
                  onMouseDown={(e) => handleCropMouseDown(e, 'move')}
                  style={{
                    position: 'absolute',
                    left: `${screenCrop.left}px`,
                    top: `${screenCrop.top}px`,
                    width: `${screenCrop.width}px`,
                    height: `${screenCrop.height}px`
                  }}
                  className="border-2 border-blue-500 shadow-2xl pointer-events-auto cursor-move select-none"
                >
                  {/* Rule of thirds grid lines */}
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                    <div className="border-r border-b border-white/20" />
                    <div className="border-r border-b border-white/20" />
                    <div className="border-b border-white/20" />
                    <div className="border-r border-b border-white/20" />
                    <div className="border-r border-b border-white/20" />
                    <div className="border-b border-white/20" />
                    <div className="border-r border-white/20" />
                    <div className="border-r border-white/20" />
                    <div />
                  </div>

                  {/* Dimensions badge */}
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap backdrop-blur-xs">
                    {Math.round(cropBox.width)} × {Math.round(cropBox.height)} px
                  </div>

                  {/* 4 Corner Handles */}
                  <div
                    onMouseDown={(e) => handleCropMouseDown(e, 'nw')}
                    className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                    title="Resize crop (Top-Left)"
                  />
                  <div
                    onMouseDown={(e) => handleCropMouseDown(e, 'ne')}
                    className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                    title="Resize crop (Top-Right)"
                  />
                  <div
                    onMouseDown={(e) => handleCropMouseDown(e, 'sw')}
                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow-md cursor-nesw-resize hover:scale-125 transition-transform"
                    title="Resize crop (Bottom-Left)"
                  />
                  <div
                    onMouseDown={(e) => handleCropMouseDown(e, 'se')}
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm shadow-md cursor-nwse-resize hover:scale-125 transition-transform"
                    title="Resize crop (Bottom-Right)"
                  />

                  {/* 4 Edge Handles */}
                  <div
                    onMouseDown={(e) => handleCropMouseDown(e, 'n')}
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-ns-resize hover:scale-110 transition-transform"
                    title="Resize crop (Top)"
                  />
                  <div
                    onMouseDown={(e) => handleCropMouseDown(e, 's')}
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-ns-resize hover:scale-110 transition-transform"
                    title="Resize crop (Bottom)"
                  />
                  <div
                    onMouseDown={(e) => handleCropMouseDown(e, 'w')}
                    className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-8 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-ew-resize hover:scale-110 transition-transform"
                    title="Resize crop (Left)"
                  />
                  <div
                    onMouseDown={(e) => handleCropMouseDown(e, 'e')}
                    className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-8 bg-white border-2 border-blue-600 rounded-full shadow-md cursor-ew-resize hover:scale-110 transition-transform"
                    title="Resize crop (Right)"
                  />
                </div>
              </div>
            )}

            {/* Draggable Movable Text Badges Overlay */}
            {canvasRef.current && textItems.map((item) => {
              const canvas = canvasRef.current;
              const rect = canvas.getBoundingClientRect();
              const scaleX = rect.width / canvas.width;
              const scaleY = rect.height / canvas.height;

              const screenX = item.x * scaleX;
              const screenY = item.y * scaleY;
              const isSelected = item.id === selectedTextId;

              return (
                <div
                  key={item.id}
                  onMouseDown={(e) => handleTextMouseDown(e, item)}
                  style={{
                    position: 'absolute',
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    color: item.color,
                    fontSize: `${Math.max(12, Math.round(item.fontSize * scaleX))}px`,
                    lineHeight: 1.2
                  }}
                  className={`group select-none cursor-move px-2 py-1 rounded bg-black/65 font-bold shadow-lg transition-shadow backdrop-blur-2xs flex items-center gap-1.5 ${
                    isSelected 
                      ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900 border border-white' 
                      : 'hover:ring-1 hover:ring-white/80'
                  }`}
                  title="Click and drag to move text anywhere on image"
                >
                  <Move className="w-3 h-3 text-white/70 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                  <span className="whitespace-nowrap">{item.text}</span>
                  {isSelected && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteText(item.id);
                      }}
                      className="ml-1 text-white/70 hover:text-rose-400 p-0.5 cursor-pointer"
                      title="Remove text"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <span className="text-[11px] text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            {activeTool === 'pen' && 'Use mouse/trackpad to draw freely on the image.'}
            {activeTool === 'crop' && 'Drag borders or corner handles on the image to crop, then click Apply Crop.'}
            {activeTool === 'text' && 'Type text and click + Add Text, then drag it freely anywhere on the image.'}
          </span>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
