{/* --- CONTACT US --- */}
<section className="mt-12 border-t border-slate-800 pt-10">
  <div className="max-w-5xl mx-auto px-4">
    <div className="grid gap-8 md:grid-cols-[1.1fr_minmax(0,1fr)] items-start">
      {/* Left: heading + copy */}
      <div>
        <h2 className="text-3xl md:text-4xl font-extrabold mb-3">
          Have questions?<br />
          <span className="text-orange-500">Shoot us a message.</span>
        </h2>
        <p className="text-slate-300 text-sm md:text-base mb-4">
          Got a question about your streak, a rules call, prizes, or a tech issue?
          Use the form and the STREAKr crew will get back to you.
        </p>
        <p className="text-slate-400 text-xs md:text-sm">
          We read every message. During AFL season we try to reply within
          <span className="font-semibold text-slate-200"> 24–48 hours.</span>
        </p>
      </div>

      {/* Right: form card */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 md:p-7 shadow-xl">
        <form
          action="/api/contact"  // TODO: wire this up on the backend
          method="POST"
          className="space-y-4"
        >
          {/* Category */}
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              What’s this about?
            </label>
            <select
              name="category"
              className="w-full rounded-lg bg-[#0B1220] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/70"
              defaultValue="general"
            >
              <option value="general">General question / feedback</option>
              <option value="account">Account / login</option>
              <option value="picks">Picks, streaks or scoring</option>
              <option value="prizes">Prizes / rewards</option>
              <option value="bug">Bug / technical issue</option>
              <option value="other">Something else</option>
            </select>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Your name
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full rounded-lg bg-[#0B1220] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/70"
              placeholder="Your name"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Your email
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-lg bg-[#0B1220] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/70"
              placeholder="you@example.com"
            />
          </div>

          {/* Message */}
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Your message
            </label>
            <textarea
              name="message"
              rows={4}
              required
              className="w-full rounded-lg bg-[#0B1220] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/70"
              placeholder="Tell us what’s going on…"
            />
          </div>

          {/* Optional screenshot */}
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Screenshot (optional)
            </label>
            <input
              type="file"
              name="screenshot"
              accept="image/png,image/jpeg"
              className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-500 file:text-black hover:file:bg-orange-600"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Helpful if you’re reporting a bug or error message.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold py-2.5 rounded-lg text-sm shadow-lg transition"
          >
            Send message
          </button>
        </form>
      </div>
    </div>
  </div>
</section>
