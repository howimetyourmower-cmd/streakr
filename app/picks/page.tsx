  const content = useMemo(() => {
    if (loading) return <p>Loading…</p>;
    if (!games.length) return <p>No games found for this round.</p>;

    return (
      <ol className="space-y-10">
        {games.map((g, gi) => (
          <li key={gi} className="rounded-2xl border border-white/10 bg-[#11161C] p-6">
            {/* Game header */}
            <div className="mb-4">
              <h2 className="text-2xl font-semibold">{g.match}</h2>
              <div className="text-sm text-white/70">{fmtGameMeta(g)}</div>
            </div>

            {/* Questions inline with buttons right-aligned */}
            <div className="space-y-4">
              {g.questions?.map((q, qi) => (
                <div
                  key={qi}
                  className="flex justify-between items-center rounded-xl bg-[#0E1318] px-4 py-3 border border-white/10"
                >
                  <div>
                    <div className="text-xs uppercase text-white/60">
                      {q.quarter ? `Q${q.quarter}` : "Quarter"}
                    </div>
                    <div className="font-medium text-white">{q.question}</div>
                  </div>

                  <div className="flex gap-2">
                    <button className="rounded-xl bg-green-600 hover:bg-green-700 px-5 py-2 text-sm font-semibold text-white transition">
                      Yes
                    </button>
                    <button className="rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2 text-sm font-semibold text-white transition">
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
    );
  }, [games, loading]);
