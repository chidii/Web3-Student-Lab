"use client";

import { DecodedValue, decodeScVal, SOROBAN_RPC_URL } from "@/lib/soroban-tools";
import { Address, rpc, xdr } from "@stellar/stellar-sdk";
import { useState } from "react";

interface StorageEntry {
  key: DecodedValue;
  value: DecodedValue;
  durability: string;
  rawKey: string;
  rawValue: string;
}

interface HistoryEntry {
  timestamp: string;
  value: DecodedValue;
}

function JsonValue({ val, depth = 0 }: { val: DecodedValue; depth?: number }) {
  if (val === null) return <span className="text-gray-500">null</span>;
  if (typeof val === "boolean") return <span className="text-purple-400">{String(val)}</span>;
  if (typeof val === "number" || typeof val === "bigint")
    return <span className="text-blue-400">{String(val)}</span>;
  if (typeof val === "string") return <span className="text-green-400">"{val}"</span>;
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-gray-400">[]</span>;
    return (
      <span>
        {"["}
        <div className="pl-4">
          {val.map((v, i) => (
            <div key={i}>
              <JsonValue val={v} depth={depth + 1} />
              {i < val.length - 1 && <span className="text-gray-500">,</span>}
            </div>
          ))}
        </div>
        {"]"}
      </span>
    );
  }
  if (typeof val === "object") {
    const keys = Object.keys(val);
    if (keys.length === 0) return <span className="text-gray-400">{"{}"}</span>;
    return (
      <span>
        {"{"}
        <div className="pl-4">
          {keys.map((k, i) => (
            <div key={k}>
              <span className="text-yellow-400">"{k}"</span>
              <span className="text-gray-400">: </span>
              <JsonValue val={(val as Record<string, DecodedValue>)[k]} depth={depth + 1} />
              {i < keys.length - 1 && <span className="text-gray-500">,</span>}
            </div>
          ))}
        </div>
        {"}"}
      </span>
    );
  }
  return <span className="text-gray-300">{String(val)}</span>;
}

async function loadContractStorage(contractId: string): Promise<StorageEntry[]> {
  const server = new rpc.Server(SOROBAN_RPC_URL);
  const entries: StorageEntry[] = [];

  // Build contract address
  let contractAddress: xdr.ScAddress;
  try {
    contractAddress = new Address(contractId).toScAddress();
  } catch {
    throw new Error("Invalid contract ID");
  }

  // Fetch instance storage
  const instanceKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: contractAddress,
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    })
  );

  try {
    const result = await server.getLedgerEntries(instanceKey);
    for (const item of result.entries) {
      if (item.val.switch().name === "contractData") {
        const cd = item.val.contractData();
        const val = cd.val();
        // Instance storage contains the contract instance with storage map
        if (val.switch().name === "scvContractInstance") {
          const inst = val.instance();
          const storage = inst.storage();
          if (storage) {
            for (const entry of storage) {
              entries.push({
                key: decodeScVal(entry.key()),
                value: decodeScVal(entry.val()),
                durability: "instance",
                rawKey: entry.key().toXDR("base64"),
                rawValue: entry.val().toXDR("base64"),
              });
            }
          }
        } else {
          entries.push({
            key: decodeScVal(cd.key()),
            value: decodeScVal(val),
            durability: "instance",
            rawKey: cd.key().toXDR("base64"),
            rawValue: val.toXDR("base64"),
          });
        }
      }
    }
  } catch (e) {
    console.warn("Instance storage fetch failed:", e);
  }

  return entries;
}

export default function StoragePage() {
  const [contractId, setContractId] = useState("");
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey,setSelectedKey] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});

  const handleLoad = async () => {
    if (!contractId.trim()) return;
    setLoading(true);
    setError(null);
    setEntries([]);
    try {
      const result = await loadContractStorage(contractId.trim());
      setEntries(result);
      // Record history snapshot
      const ts = new Date().toISOString();
      const newHistory: Record<string, HistoryEntry[]> = { ...history };
      for (const e of result) {
        const k = String(e.key);
        if (!newHistory[k]) newHistory[k] = [];
        newHistory[k] = [{ timestamp: ts, value: e.value }, ...newHistory[k]].slice(0, 10);
      }
      setHistory(newHistory);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load storage");
    } finally {
      setLoading(false);
    }
  };

  const durabilityColor = (d: string) =>
    d === "persistent" ? "text-blue-400" :
    d === "temporary" ? "text-yellow-400" : "text-purple-400";

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black mb-6 text-red-500">CONTRACT STORAGE BROWSER</h1>

        {/* Input */}
        <div className="bg-zinc-900 border border-white/10 rounded-lg p-4 mb-6 flex gap-4">
          <input
            type="text"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            placeholder="Enter Contract ID (C...)"
            className="flex-1 bg-black border border-white/20 rounded px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={handleLoad}
            disabled={loading || !contractId.trim()}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded font-bold text-sm"
          >
            {loading ? "LOADING..." : "BROWSE"}
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-500/50 rounded p-3 text-red-400 text-sm">
            {error}
       </div>
        )}

        {entries.length > 0 && (
          <div className="grid grid-cols-3 gap-6">
            {/* Key List */}
            <div className="col-span-1 bg-zinc-900 border border-white/10 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 text-xs font-bold text-gray-400">
                STORAGE KEYS ({entries.length})
              </div>
              <div className="divide-y divide-white/5">
                {entries.map((entry, i) => {
                  const k = String(entry.key);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedKey(k)}
                      className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors ${
                        selectedKey === k ? "bg-red-900/20 border-l-2 border-red-500" : ""
                      }`}
                    >
                      <div className="text-xs font-mono text-white truncate">{k}</div>
                      <div className={`text-xs mt-0.5 ${durabilityColor(entry.durability)}`}>
                        {entry.durability}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Value Viewer */}
            <div className="col-span-2 space-y-4">
              {selectedKey ? (
                <>
                  {/* Current Value */}
                  <div className="bg-zinc-900 border border-white/10 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 text-xs font-bold text-gray-400">
                      VALUE — <span className="font-mono text-white">{selectedKey}</span>
                    </div>
                    <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto">
                      <JsonValue val={entries.find((e) => String(e.key) === selectedKey)?.value ?? null} />
                    </div>
                  </div>

                  {/* History */}
                  {history[selectedKey] && history[selectedKey].length > 1 && (
                    <div className="bg-zinc-900 border border-white/10 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/10 text-xs font-bold text-gray-400">
                        HISTORY
                      </div>
                      <div className="divide-y divide-white/5">
                        {history[selectedKey].map((h, i) => (
                          <div key={i} className="px-4 py-3">
                            <div className="text-xs text-gray-500 mb-1">{new Date(h.timestamp).toLocaleString()}</div>
                            <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
                              {JSON.stringify(h.value, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-zinc-900 border border-white/10 rounded-lg p-8 text-center text-gray-500">
                  Select a key to view its value
                </div>
              )}
            </div>
          </div>
        )}

        {entries.length === 0 && !loading && !error && (
          <div className="bg-zinc-900 border border-white/10 rounded-lg p-8 text-center text-gray-500">
            Enter a contract ID and click BROWSE to explore its storage
          </div>
        )}
      </div>
    </div>
  );
}
