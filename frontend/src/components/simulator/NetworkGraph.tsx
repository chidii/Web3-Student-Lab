import { Maximize, Search, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNetworkGraph } from '../../hooks/useNetworkGraph';
import { NetworkNode as NodeData } from '../../lib/visualization/ForceSimulation';
import { GraphEdge } from './GraphEdge';
import { GraphNode } from './GraphNode';
import { NodeDetailPanel } from './NodeDetailPanel';

interface NetworkGraphProps {
  transactions: any[];
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({ transactions }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [zoom, setZoom] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    }
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { graph, addTransaction } = useNetworkGraph(dimensions.width, dimensions.height);

  // Sync new transactions to graph
  useEffect(() => {
    if (transactions.length > 0) {
      addTransaction(transactions[0]);
    }
  }, [transactions, addTransaction]);

  const filteredNodes = graph.nodes.filter(n =>
    n.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative w-full h-full bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden group">
      {/* Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg p-1">
          <button onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="p-2 hover:bg-white/10 rounded transition-colors">
            <ZoomIn size={16} />
          </button>
          <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="p-2 hover:bg-white/10 rounded transition-colors">
            <ZoomOut size={16} />
          </button>
          <button onClick={() => setZoom(1)} className="p-2 hover:bg-white/10 rounded transition-colors">
            <Maximize size={16} />
          </button>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg px-3 py-1.5">
          <Search size={14} className="text-gray-500" />
          <input
            type="text"
            placeholder="Search Account..."
            className="bg-transparent border-none outline-none text-xs w-32 font-mono"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
        <g transform={`translate(${dimensions.width/2}, ${dimensions.height/2}) scale(${zoom}) translate(${-dimensions.width/2}, ${-dimensions.height/2})`}>
          {graph.edges.map(edge => (
            <GraphEdge key={edge.id} edge={edge} />
          ))}
          {filteredNodes.map(node => (
            <GraphNode
              key={node.id}
              node={node}
              onClick={setSelectedNode}
            />
          ))}
        </g>
      </svg>

      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}

      <div className="absolute bottom-4 left-4 pointer-events-none">
        <h4 className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Graph Visualization Engine</h4>
        <div className="flex gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-[9px] uppercase text-gray-400">Accounts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-[9px] uppercase text-gray-400">Assets</span>
          </div>
        </div>
      </div>
    </div>
  );
};
