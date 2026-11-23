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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Engineering Canvas & Diagram Drawer</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Draw flowcharts, circuits, ER diagrams, or architecture schematics natively.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-sm">
          <div className="flex items-center gap-1 border-r border-slate-300 dark:border-slate-700 pr-2">
            <button
              onClick={() => setTool('pen')}
              className={`p-1.5 rounded-lg ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              title="Pen / Freehand"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('line')}
              className={`p-1.5 rounded-lg ${tool === 'line' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              title="Line"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('arrow')}
              className={`p-1.5 rounded-lg ${tool === 'arrow' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              title="Arrow"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('rect')}
              className={`p-1.5 rounded-lg ${tool === 'rect' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              title="Rectangle"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('circle')}
              className={`p-1.5 rounded-lg ${tool === 'circle' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              title="Circle"
            >
              <Circle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('text')}
              className={`p-1.5 rounded-lg ${tool === 'text' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              title="Text Annotation"
            >
              <Type className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-1.5 rounded-lg ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
              title="Eraser"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 border-r border-slate-300 dark:border-slate-700 pr-2">
            <label className="text-xs text-slate-500 font-medium">Color:</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-7 h-7 rounded border border-slate-300 dark:border-slate-600 cursor-pointer p-0"
            />
            <label className="text-xs text-slate-500 font-medium ml-2">Width:</label>
            <select
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value={1}>1px</option>
              <option value={2}>2px</option>
              <option value={4}>4px</option>
              <option value={6}>6px</option>
            </select>
          </div>

          <div className="flex items-center gap-1 border-r border-slate-300 dark:border-slate-700 pr-2">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded ${showGrid ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              title="Toggle Grid Guide"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={clearCanvas}
            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded flex items-center gap-1 text-xs font-semibold ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>

        {/* Canvas Area */}
        <div className="p-6 bg-slate-100 dark:bg-slate-950 flex justify-center items-center overflow-auto relative">
          <div className="relative shadow-lg border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-white">
            {showGrid && (
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: 'radial-gradient(circle, #64748b 1px, transparent 1px)',
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Diagram will be embedded as a high-resolution asset inside your academic document.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Insert Diagram
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
