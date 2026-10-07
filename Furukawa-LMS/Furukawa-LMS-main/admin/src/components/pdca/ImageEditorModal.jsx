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
  
  // Crop state
  const [cropStart, setCropStart] = useState(null);
  const [cropEnd, setCropEnd] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

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

  // Initialize and load image onto canvas
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      // Set canvas size to match image natural size, capped reasonably for display
      const maxW = 1000;
      const maxH = 650;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;

      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // Save initial state into history
      setHistory([canvas.toDataURL()]);
      setCropStart(null);
      setCropEnd(null);
      setIsCropping(false);
      setTextItems([]);
      setSelectedTextId(null);
      setTextInput('');
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
      setCropStart(null);
      setCropEnd(null);
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

  /* ─── Pen / Freehand Drawing & Crop ────────────────── */
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
    } else if (activeTool === 'crop') {
      const { x, y } = getCanvasCoords(e);
      setCropStart({ x, y });
      setCropEnd({ x, y });
      setIsCropping(true);
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
    } else if (activeTool === 'crop' && isCropping) {
      const { x, y } = getCanvasCoords(e);
      setCropEnd({ x, y });
    }
  };

  const handleCanvasMouseUp = () => {
    if (activeTool === 'pen' && isDrawing) {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.closePath();
      setIsDrawing(false);
      saveSnapshot();
    } else if (activeTool === 'crop' && isCropping) {
      setIsCropping(false);
    }
  };

  /* ─── Movable Text Management ───────────────────────── */
  // Add a new text badge directly onto the canvas (centered or at offset)
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

  // Start dragging a specific text item
  const handleTextMouseDown = (e, item) => {
    e.stopPropagation();
    setSelectedTextId(item.id);
    setIsDraggingText(true);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = getCanvasCoords(e);
    dragOffsetRef.current = {
      x: coords.x - item.x,
      y: coords.y - item.y
    };
  };

  // Global mouse move and mouse up for smooth dragging across canvas
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

  // Update selected text properties
  const handleUpdateSelectedText = (field, val) => {
    if (!selectedTextId) return;
    setTextItems((prev) =>
      prev.map((item) => (item.id === selectedTextId ? { ...item, [field]: val } : item))
    );
  };

  // Remove a text item
  const handleDeleteText = (id) => {
    setTextItems((prev) => prev.filter((item) => item.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  };

  /* ─── Apply Crop ───────────────────────────────────── */
  const applyCrop = () => {
    if (!cropStart || !cropEnd) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);

    if (width < 20 || height < 20) {
      alert('Selected crop area is too small.');
      return;
    }

    // First, burn current text items into the canvas before cropping so they adjust with crop
    burnTextToCanvas();

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the cropped portion to temporary canvas
    tempCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

    // Resize main canvas
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(tempCanvas, 0, 0);

    setCropStart(null);
    setCropEnd(null);
    setIsCropping(false);
    setTextItems([]);
    setSelectedTextId(null);
    saveSnapshot();
  };

  const cancelCrop = () => {
    setCropStart(null);
    setCropEnd(null);
    setIsCropping(false);
  };

  /* ─── Burn movable text items to canvas ─────────────── */
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

      // Dark translucent pill background for crisp readability
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

      // Text drawing
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    });
  };

  /* ─── Final Save ───────────────────────────────────── */
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Render movable text items directly onto the canvas before export
    burnTextToCanvas();

    const updatedDataUrl = canvas.toDataURL('image/png');
    onSave(updatedDataUrl);
    onClose();
  };

  if (!isOpen) return null;

  // Calculate crop rectangle display for overlay
  let cropOverlay = null;
  if (canvasRef.current && cropStart && cropEnd) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    const x = Math.min(cropStart.x, cropEnd.x) * scaleX;
    const y = Math.min(cropStart.y, cropEnd.y) * scaleY;
    const w = Math.abs(cropEnd.x - cropStart.x) * scaleX;
    const h = Math.abs(cropEnd.y - cropStart.y) * scaleY;

    cropOverlay = { left: x, top: y, width: w, height: h };
  }

  // Selected item object (if any)
  const selectedTextObj = textItems.find((t) => t.id === selectedTextId);

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
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
                Annotate with Pen, Crop area, or Add & Move text freely
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
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
              title="Reset image to original"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Pen, Crop, Add Text, Color picker, Movable Text Controls */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap text-xs">
          {/* Tool selector buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => { setActiveTool('pen'); cancelCrop(); }}
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
              onClick={() => { setActiveTool('crop'); }}
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
              onClick={() => { setActiveTool('text'); cancelCrop(); }}
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

            {/* Crop Action Buttons */}
            {activeTool === 'crop' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Drag a box on the image:</span>
                <button
                  onClick={applyCrop}
                  disabled={!cropStart || !cropEnd}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
                >
                  Apply Crop
                </button>
                {cropStart && (
                  <button
                    onClick={cancelCrop}
                    className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
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
                  ? 'cursor-crosshair' 
                  : 'cursor-default'
              }`}
            />

            {/* Crop Box Visual Overlay */}
            {cropOverlay && (
              <div 
                style={{
                  position: 'absolute',
                  left: `${cropOverlay.left}px`,
                  top: `${cropOverlay.top}px`,
                  width: `${cropOverlay.width}px`,
                  height: `${cropOverlay.height}px`,
                  border: '2px dashed #3B82F6',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  pointerEvents: 'none'
                }}
              />
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
            {activeTool === 'crop' && 'Click & drag a rectangle over the image, then click Apply Crop.'}
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
