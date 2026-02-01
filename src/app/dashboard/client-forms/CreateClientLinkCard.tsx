"use client";

import { useState } from "react";

export default function CreateClientLinkCard() {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createLink() {
    setLoading(true);
    setError(null);
    setLink(null);

    const res = await fetch("/api/client-form-links", {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data?.error || "Failed to create link");
    } else {
      setLink(`${window.location.origin}/client-form/${data.token}`);
    }

    setLoading(false);
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-xl">
      <h2 className="text-lg font-semibold mb-2">Create Client Order Form Link</h2>
      <p className="text-sm text-gray-600 mb-4">
        Generate a secure one-time link for clients to submit order details.
      </p>

      <button
        onClick={createLink}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Creating..." : "Create Link"}
      </button>

      {error && <p className="text-red-600 mt-3">{error}</p>}

      {link && (
        <div className="mt-4">
          <label className="text-sm font-medium">Client Link</label>
          <input
            value={link}
            readOnly
            onClick={(e) => e.currentTarget.select()}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Click to select and copy
          </p>
        </div>
      )}
    </div>
  );
}
