"use client";

import { useWallet, WALLET_PROVIDERS } from "@/contexts/WalletContext";
import { useState } from "react";

function truncate(pk: string) {
  return `${pk.slice(0, 6)}...${pk.slice(-6)}`;
}

export default function WalletPage() {
  const { publicKey, activeWallet, isConnecting, error, connect, disconnect } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = async (name: string) => {
    setConnectError(null);
    try {
      await connect(name);
      setShowModal(false);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Connection failed");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-black mb-6 text-red-500">WALLET CONNECT</h1>

        {publicKey ? (
          <div className="bg-zinc-900 border border-green-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-400 font-bold text-sm">CONNECTED — {activeWallet}</span>
            </div>
            <div className="bg-black rounded p-3 font-mono text-sm text-gray-300 mb-4 break-all">
              {publicKey}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigator.clipboard.writeText(publicKey)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-bold"
              >
                COPY ADDRESS
              </button>
              <button
                onClick={disconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-bold"
              >
                DISCONNECT
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm font-bold"
              >
                SWITCH WALLET
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-white/10 rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">🔗</div>
            <p className="text-gray-400 mb-6">Connect a Stellar wallet to interact with the network</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded font-bold"
            >
              CONNECT WALLET
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-500/50 rounded p-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Wallet Info Cards */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          {WALLET_PROVIDERS.map((p) => (
            <div key={p.name} className="bg-zinc-900 border border-white/10 rounded-lg p-4">
              <div className="text-3xl mb-2">{p.icon}</div>
              <div className="font-bold text-sm mb-1">{p.name}</div>
              <div className={`text-xs ${p.isInstalled() ? "text-green-400" : "text-gray-500"}`}>
                {p.isInstalled() ? "Detected" : "Not installed"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connect Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-white/20 rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black">SELECT WALLET</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            {connectError && (
              <div className="mb-4 bg-red-900/30 border border-red-500/50 rounded p-3 text-red-400 text-xs">
                {connectError}
              </div>
            )}

            <div className="space-y-3">
              {WALLET_PROVIDERS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => handleConnect(p.name)}
                  disabled={isConnecting}
                  className="w-full flex items-center gap-4 p-4 bg-black hover:bg-zinc-800 border border-white/10 hover:border-red-500/50 rounded-lg transition-all disabled:opacity-50"
                >
                  <span className="text-2xl">{p.icon}</span>
                  <div className="text-left">
                    <div className="font-bold text-sm">{p.name}</div>
                    <div className={`text-xs ${p.isInstalled() ? "text-green-400" : "text-gray-500"}`}>
                      {p.isInstalled() ? "Ready to connect" : "Install required"}
                    </div>
                  </div>
                  {activeWallet === p.name && (
                    <span className="ml-auto text-xs text-green-400 font-bold">ACTIVE</span>
                  )}
                </button>
              ))}
            </div>

            {isConnecting && (
              <div className="mt-4 text-center text-sm text-gray-400">Connecting...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
