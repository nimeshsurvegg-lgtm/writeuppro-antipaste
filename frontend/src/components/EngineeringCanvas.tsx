import React, { useRef, useState, useEffect } from 'react';
import { Pencil, Minus, ArrowRight, Square, Circle, Type, Eraser, Trash2, Check, Grid, Undo2, Redo2, X } from 'lucide-react';

interface EngineeringCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
}

type Tool = 'pen' | 'line' | 'arrow' | 'rect' | 'circle' | 'text' | 'eraser';

export const EngineeringCanvas: React.FC<EngineeringCanvasProps> = ({ isOpen, onClose, onInsert }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#0f172a');
  const [lineWidth, setLineWidth] = useState(2);
  const [showGrid, setShowGrid] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveState();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imgData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const newIndex = historyIndex - 1;
      ctx.putImageData(history[newIndex], 0, 0);
      setHistoryIndex(newIndex);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const newIndex = historyIndex + 1;
      ctx.putImageData(history[newIndex], 0, 0);
      setHistoryIndex(newIndex);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(coords);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (tool === 'text') {
      const text = prompt('Enter diagram label / text annotation:');
      if (text) {
        ctx.fillStyle = color;
        ctx.font = '14px JetBrains Mono, sans-serif';
        ctx.fillText(text, coords.x, coords.y);
        saveState();
      }
      setIsDrawing(false);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else {
      // Temporary preview for shapes: restore previous snapshot then draw candidate
      if (historyIndex >= 0 && history[historyIndex]) {
        ctx.putImageData(history[historyIndex], 0, 0);
      }
      ctx.beginPath();
      if (tool === 'line') {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      } else if (tool === 'arrow') {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(coords.y - startPos.y, coords.x - startPos.x);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineTo(coords.x - headLen * Math.cos(angle - Math.PI / 6), coords.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(coords.x, coords.y);
        ctx.lineTo(coords.x - headLen * Math.cos(angle + Math.PI / 6), coords.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(startPos.x, startPos.y, coords.x - startPos.x, coords.y - startPos.y);
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(coords.x - startPos.x, 2) + Math.pow(coords.y - startPos.y, 2));
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveState();
    }
  };

  const handleInsert = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onInsert(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#1D1814] border-2 border-[#1A1209] shadow-[6px_6px_0px_#1A1209] w-full max-w-4xl overflow-hidden flex flex-col font-mono">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-[#F4EFE6] dark:bg-[#26201B] border-b-2 border-[#1A1209]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#B84915] block">
              VECTOR SCHEMATICS // CANVAS MODULE
            </span>
            <h3 className="text-base font-extrabold tracking-tight text-[#1A1209] dark:text-white">
              Engineering Canvas & Diagram Drawer.
            </h3>
          </div>
          <button onClick={onClose} className="neo-btn p-1.5 bg-white dark:bg-[#1D1814] text-[#1A1209] dark:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-2.5 bg-[#FAF6EE] dark:bg-[#26201B] border-b-2 border-[#1A1209] text-xs">
          <div className="flex items-center gap-1 border-r-2 border-[#1A1209] pr-3">
            <button
              onClick={() => setTool('pen')}
              className={`p-1.5 border border-[#1A1209] ${tool === 'pen' ? 'bg-[#1A365D] text-white' : 'bg-white text-[#1A1209]'}`}
              title="Pen / Freehand"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTool('line')}
              className={`p-1.5 border border-[#1A1209] ${tool === 'line' ? 'bg-[#1A365D] text-white' : 'bg-white text-[#1A1209]'}`}
              title="Line"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTool('arrow')}
              className={`p-1.5 border border-[#1A1209] ${tool === 'arrow' ? 'bg-[#1A365D] text-white' : 'bg-white text-[#1A1209]'}`}
              title="Arrow"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTool('rect')}
              className={`p-1.5 border border-[#1A1209] ${tool === 'rect' ? 'bg-[#1A365D] text-white' : 'bg-white text-[#1A1209]'}`}
              title="Rectangle"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTool('circle')}
              className={`p-1.5 border border-[#1A1209] ${tool === 'circle' ? 'bg-[#1A365D] text-white' : 'bg-white text-[#1A1209]'}`}
              title="Circle"
            >
              <Circle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTool('text')}
              className={`p-1.5 border border-[#1A1209] ${tool === 'text' ? 'bg-[#1A365D] text-white' : 'bg-white text-[#1A1209]'}`}
              title="Text Annotation"
            >
              <Type className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-1.5 border border-[#1A1209] ${tool === 'eraser' ? 'bg-[#1A365D] text-white' : 'bg-white text-[#1A1209]'}`}
              title="Eraser"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 border-r-2 border-[#1A1209] pr-3">
            <label className="text-[10px] text-[#786958] font-bold uppercase">Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-6 border border-[#1A1209] cursor-pointer p-0 bg-transparent"
            />
            <label className="text-[10px] text-[#786958] font-bold uppercase ml-1">Width:</label>
            <select
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="px-2 py-1 text-xs border border-[#1A1209] bg-white text-[#1A1209] font-bold"
            >
              <option value={1}>1px</option>
              <option value={2}>2px</option>
              <option value={4}>4px</option>
              <option value={6}>6px</option>
            </select>
          </div>

          <div className="flex items-center gap-1 border-r-2 border-[#1A1209] pr-3">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="neo-btn p-1 bg-white text-[#1A1209] disabled:opacity-40"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="neo-btn p-1 bg-white text-[#1A1209] disabled:opacity-40"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1 border border-[#1A1209] ${showGrid ? 'bg-[#1A365D] text-white' : 'bg-white text-[#1A1209]'}`}
              title="Toggle Grid Guide"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={clearCanvas}
            className="neo-btn px-2.5 py-1 text-[#8B1A1A] bg-[#FFF5F5] border-[#8B1A1A] text-[11px] ml-auto"
          >
            <Trash2 className="w-3 h-3 mr-1 inline" /> CLEAR
          </button>
        </div>

        {/* Canvas Area */}
        <div className="p-6 bg-[#ECE4D4] dark:bg-[#12100E] flex justify-center items-center overflow-auto relative">
          <div className="relative border-2 border-[#1A1209] shadow-[4px_4px_0px_#1A1209] overflow-hidden bg-white">
            {showGrid && (
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: 'radial-gradient(circle, #1A1209 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
            )}
            <canvas
              ref={canvasRef}
              width={760}
              height={420}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="cursor-crosshair block"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t-2 border-[#1A1209] bg-[#FAF6EE] dark:bg-[#26201B]">
          <p className="text-[10px] text-[#786958]">
            Diagram will be embedded as a high-resolution vector asset into your academic write-up.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="neo-btn px-4 py-1.5 text-xs bg-white text-[#1A1209]"
            >
              CANCEL
            </button>
            <button
              onClick={handleInsert}
              className="neo-btn px-5 py-1.5 text-xs bg-[#B84915] hover:bg-[#A03D0E] text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" /> INSERT DIAGRAM →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
