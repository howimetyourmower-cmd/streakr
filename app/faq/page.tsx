"use client";

import { useState } from "react";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { app } from "../config/firebaseClient";

export default function FAQPage() {
  const db = getFirestore(app);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<null | "ok" | "err">(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSent(null);
    try {
      await addDoc(collection(db, "contact"), {
        name,
        email,
        message,
        createdAt: serverTimestamp(),
      });
      setSent("ok");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      console.error(err);
      setSent("err");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f13] text-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-8 text-4xl font-extrabold">FAQ</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-4 text-xl font-bold text-orange-400">How it works</h2>
            <ul className="space-y-3 text-white/90">
              <li><span className="font-semibold">Pick:</span> Choose <em>Yes</em> or <em>No</em> on a quarter question.</li>
              <li><span className="font-semibold">Streak:</span> Every correct pick adds to your streak; one wrong pick ends it.</li>
              <li><span className="font-semibold">Win:</span> Longest streak for the round takes the prize.</li>
              <li><span className="font-semibold">Status:</span> Questions show <span className="text-green-400 font-semibold">OPEN</span>, <span className="text-purple-300 font-semibold">PENDING</span>, or <span className="text-blue-300 font-semibold">FINAL</span> after settlement.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="mb-4 text-xl font-bold text-orange-400">Rules & eligibility</h2>
            <ul className="space-y-3 text-white/90">
              <li>Free to play. One account per person.</li>
              <li>You must be 18+ to be eligible for prizes.</li>
              <li>Voided questions don’t affect your streak.</li>
              <li>Ties are shared; if two players tie for the longest streak but one is unbroken, the unbroken streak wins.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:col-span-2">
            <h2 className="mb-4 text-xl font-bold text-orange-400">Contact us</h2>
            <p className="mb-4 text-white/80">
              Have a question, bug report, or partnership enquiry? Send us a note below.
            </p>

            <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-white/70">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orange-400"
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-white/70">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orange-400"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-white/70">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-orange-400"
                  placeholder="How can we help?"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <button
                  disabled={sending}
                  className="rounded-xl bg-orange-500 px-5 py-3 font-semibold hover:bg-orange-600 disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send message"}
                </button>
                {sent === "ok" && (
                  <span className="ml-3 text-green-400">Thanks! We’ll be in touch.</span>
                )}
                {sent === "err" && (
                  <span className="ml-3 text-red-400">Sorry—something went wrong.</span>
                )}
              </div>
            </form>

            <div className="mt-6 text-sm text-white/60">
              Prefer email? Reach us at <a href="mailto:contact@streakr.app" className="text-orange-400 underline">contact@streakr.app</a>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
