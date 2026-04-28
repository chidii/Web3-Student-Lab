"use client";

import { DecodedEvent, decodeRpcEvent, SOROBAN_RPC_URL } from "@/lib/soroban-tools";
import { rpc } from "@stellar/stellar-sdk";
import { useEffect, useState } from "react";

// ─── Trace View ───────────────────────────────────────────────────────────────

function TraceView({ events }: { events: DecodedEvent[] }) {
  const [txHash, setTxHash] = useState("");
  const txEvents = txHash ? events.filter((e) => e.txHash === txHash) : [];
  const uniqueTxs = [...new Set(events.map((e) => e.txHash))];

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-lg p-4 mb-6">
      <div className="text-xs font-bold text-gray-400 mb-3">TRACE VIEW</div>
      <select
        value={txHash}
        onChange={(e) => setTxHash(e.target.value)}
        className="w-full bg-black border border-white/20 rounded px-3 py-2 text-sm font-mono mb-4"
      >
        <option value="">Select a transaction hash...</option>
        {uniqueTxs.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      {txHash && txEvents.length === 0 && (
        <div className="text-gray-500 text-sm text-center py-4">No events for this transaction</div>
      )}
      {txEvents.length > 0 && (
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-red-500/30" />
          {txEvents.map((evt, i) => (
            <div key={evt.id} className="relative mb-4">
              <div className="absolute -left-4 top-2 w-3 h-3 rounded-full bg-red-500 border-2 border-black" />
              <div className="bg-black border border-white/10 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-red-400">#{i + 1}</span>
                  <span className="text-xs text-gray-400">{evt.type}</span>
                  <span className="text-xs text-gray-500 font-mono">{evt.contractId.slice(0, 8)}...</span>
                </div>
                <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
                  {JSON.stringify({ topics: evt.topics, value: evt.value }, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<DecodedEvent[]>([]);
  const [contractFilter, setContractFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [lastCursor, setLastCursor] = useState("");

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(async () => {
      try {
        const server = new rpc.Server(SOROBAN_RPC_URL);
        const filters: rpc.Api.EventFilter[] = [];
        if (contractFilter) {
          filters.push({ contractIds: [contractFilter] });
        }
        if (topicFilter) {
          filters.push({ topics: [[topicFilter]] });
        }
        const result = await server.getEvents({
          startLedger: lastCursor ? undefined : 0,
          filters: filters.length > 0 ? filters : undefined,
          limit: 20,
        });
        const decoded = result.events.map(decodeRpcEvent);
        setEvents((prev) => [...decoded, ...prev].slice(0, 100));
        if (result.events.length > 0) {
          setLastCursor(result.latestLedger.toString());
        }
      } catch (e) {
        console.error("Failed to fetch events:", e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isPolling, contractFilter, topicFilter, lastCursor]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-black mb-6 text-red-500">SOROBAN EVENT LISTENER</h1>

        {/* Controls */}
        <div className="bg-zinc-900 border border-white/10 rounded-lg p-4 mb-6 space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 mb-2">CONTRACT ID</label>
              <input
                type="text"
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value)}
                placeholder="C..."
                className="w-full bg-black border border-white/20 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 mb-2">TOPIC FILTER</label>
              <input
                type="text"
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                placeholder="transfer"
                className="w-full bg-black border border-white/20 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
            <button
              onClick={() => setIsPolling(!isPolling)}
              className={`px-6 py-2 rounded font-bold text-sm ${
                isPolling
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isPolling ? "STOP" : "START"}
            </button>
            <button
              onClick={() => setEvents([])}
              className="px-6 py-2 rounded font-bold text-sm bg-zinc-700 hover:bg-zinc-600"
            >
              CLEAR
            </button>
          </div>
        </div>

        {/* Trace View */}
        {events.length > 0 && <TraceView events={events} />}

        {/* Event List */}
        <div className="space-y-3">
          {events.length === 0 && (
            <div className="bg-zinc-900 border border-white/10 rounded-lg p-8 text-center text-gray-500">
              {isPolling ? "Listening for events..." : "Click START to begin listening"}
            </div>
          )}
          {events.map((evt, i) => (
            <div key={`${evt.id}-${i}`} className="bg-zinc-900 border border-white/10 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs font-bold text-red-500">{evt.type}</span>
                  <span className="text-xs text-gray-500 ml-3">Ledger {evt.ledger}</span>
                  <span className="text-xs text-gray-500 ml-3">{new Date(evt.ledgerClosedAt).toLocaleTimeString()}</span>
                </div>
                <span className="text-xs font-mono text-gray-400">{evt.contractId.slice(0, 8)}...</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-xs font-bold text-gray-400">TOPICS:</span>
                  <pre className="text-xs font-mono bg-black p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(evt.topics, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-400">VALUE:</span>
                  <pre className="text-xs font-mono bg-black p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(evt.value, null, 2)}
                  </pre>
                </div>
                <div className="text-xs text-gray-500">
                  TX: <span className="font-mono">{evt.txHash}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
