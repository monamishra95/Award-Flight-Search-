/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

// Loyalty program codes verified against a live PointsYeah search URL
// (https://www.pointsyeah.com/explorer/search?...&programs=AA,AC,AM,...).
// Friendly names are standard public program names, not PointsYeah-internal data.
const PROGRAMS = [
  { code: 'AA', name: 'American Airlines AAdvantage', group: 'US' },
  { code: 'DL', name: 'Delta Air Lines SkyMiles', group: 'US' },
  { code: 'UA', name: 'United MileagePlus', group: 'US' },
  { code: 'AS', name: 'Alaska Airlines Mileage Plan', group: 'US' },
  { code: 'B6', name: 'JetBlue TrueBlue', group: 'US' },
  { code: 'AC', name: 'Air Canada Aeroplan', group: 'Intl' },
  { code: 'LH', name: 'Lufthansa Miles & More', group: 'Intl' },
  { code: 'KL', name: 'KLM Flying Blue', group: 'Intl' },
  { code: 'VS', name: 'Virgin Atlantic Flying Club', group: 'Intl' },
  { code: 'VA', name: 'Virgin Australia Velocity', group: 'Intl' },
  { code: 'QF', name: 'Qantas Frequent Flyer', group: 'Intl' },
  { code: 'TK', name: 'Turkish Airlines Miles&Smiles', group: 'Intl' },
  { code: 'EY', name: 'Etihad Guest', group: 'Intl' },
  { code: 'AY', name: 'Finnair Plus', group: 'Intl' },
  { code: 'AV', name: 'Avianca LifeMiles', group: 'Intl' },
  { code: 'AM', name: 'Aeroméxico Rewards', group: 'Intl' },
  { code: 'AR', name: 'Aerolíneas Plus', group: 'Intl' },
] as const;

const CABINS = ['Economy', 'Premium Economy', 'Business', 'First'] as const;

const transferData = {
  chase_ur: {
    name: "Chase Ultimate Rewards",
    partners: [
      { airline: 'United MileagePlus', ratio: 1, bonus: 0, time: 'Instant' },
      { airline: 'Air France/KLM Flying Blue', ratio: 1, bonus: 0.25, time: 'Instant' },
      { airline: 'Southwest Rapid Rewards', ratio: 1, bonus: 0, time: 'Instant' },
    ],
  },
  amex_mr: {
    name: "Amex Membership Rewards",
    partners: [
      { airline: 'Delta SkyMiles', ratio: 1, bonus: 0, time: 'Instant' },
      { airline: 'Virgin Atlantic Flying Club', ratio: 1, bonus: 0.30, time: 'Instant' },
      { airline: 'ANA Mileage Club', ratio: 1, bonus: 0, time: '48 Hours' },
    ],
  },
  citi_ty: {
    name: "Citi ThankYou Points",
    partners: [
      { airline: 'Avianca LifeMiles', ratio: 1, bonus: 0.15, time: 'Instant' },
      { airline: 'Singapore KrisFlyer', ratio: 1, bonus: 0, time: '24 Hours' },
    ],
  },
};

/**
 * Builds a real, prefilled PointsYeah search URL. Parameter names and value
 * formats here were verified against a live PointsYeah search result
 * (not guessed) — see README "Data Source" section. Values for `collection`,
 * `mixedCabin`, `sort`, and `trip` are copied verbatim from that verified
 * sample since their full semantics aren't publicly documented; everything
 * else (departure, arrival, dates, programs, cabins, weekend_only) is driven
 * by the user's actual form input.
 */
function buildPointsYeahUrl(params: {
  departure: string;
  arrival: string;
  startDate: string;
  endDate: string;
  programs: string[];
  cabins: string[];
  weekendOnly: boolean;
}): string {
  const qs = new URLSearchParams();
  qs.set('departure', params.departure ? `airport-${params.departure.toUpperCase()}` : '');
  qs.set('arrival', params.arrival ? `airport-${params.arrival.toUpperCase()}` : 'Anywhere');
  qs.set('startDate', params.startDate);
  qs.set('endDate', params.endDate || params.startDate);
  qs.set('programs', params.programs.join(','));
  qs.set('cabins', params.cabins.join(','));
  qs.set('weekend_only', String(params.weekendOnly));
  qs.set('collection', 'true');
  qs.set('mixedCabin', '60');
  qs.set('sort', 'miles');
  qs.set('trip', '');
  return `https://www.pointsyeah.com/explorer/search?${qs.toString()}`;
}

export default function App() {
  const [today, setToday] = useState('');

  // Route Intelligence State
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [searchAnywhere, setSearchAnywhere] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [weekendOnly, setWeekendOnly] = useState(false);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>(PROGRAMS.map(p => p.code));
  const [selectedCabins, setSelectedCabins] = useState<string[]>([...CABINS]);
  const [program, setProgram] = useState('United MileagePlus');
  const [isSearching, setIsSearching] = useState(false);
  const [aiTips, setAiTips] = useState<string[] | null>(null);
  const [searchError, setSearchError] = useState('');
  const [lastSearchUrl, setLastSearchUrl] = useState('');

  // Yield Calculator State
  const [ccProgram, setCcProgram] = useState<keyof typeof transferData>('chase_ur');
  const [pointsAmount, setPointsAmount] = useState<string>('');
  const [transferResults, setTransferResults] = useState<{ airline: string; time: string; bonus: number; totalMiles: number }[] | null>(null);

  useEffect(() => {
    const d = new Date().toISOString().split('T')[0];
    setToday(d);
    setStartDate(d);
    setEndDate(d);
  }, []);

  const toggleProgram = (code: string) => {
    setSelectedPrograms(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleCabin = (cabin: string) => {
    setSelectedCabins(prev =>
      prev.includes(cabin) ? prev.filter(c => c !== cabin) : [...prev, cabin]
    );
  };

  const handleSearchFlights = async () => {
    const o = origin.trim();
    if (!o) {
      setSearchError('SYS.ERROR: Origin airport code is required.');
      return;
    }
    if (selectedPrograms.length === 0) {
      setSearchError('SYS.ERROR: Select at least one loyalty program.');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setAiTips(null);

    const url = buildPointsYeahUrl({
      departure: o,
      arrival: searchAnywhere ? '' : destination.trim(),
      startDate,
      endDate,
      programs: selectedPrograms,
      cabins: selectedCabins,
      weekendOnly,
    });
    setLastSearchUrl(url);
    window.open(url, '_blank', 'noopener,noreferrer');

    // Real award availability is searched on PointsYeah (above). The call
    // below is a separate, server-proxied Gemini request for general
    // strategic tips — it does not pull live award data of its own.
    try {
      const d = searchAnywhere ? 'Anywhere' : destination.trim() || 'your destination';
      const res = await fetch('/api/strategy-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: o, destination: d, depDate: startDate, program }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }

      const { tips } = await res.json();
      setAiTips(tips);
    } catch (err: any) {
      setSearchError(`SYS.ERROR (AI tips only — PointsYeah search still opened): ${err.message || 'Failed to fetch AI strategy.'}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCalculateTransfer = () => {
    const pts = Number(pointsAmount);
    if (!pts || pts < 1000) {
      alert('SYS.WARNING: Enter a valid point value (min 1000).');
      return;
    }

    const programData = transferData[ccProgram];
    const results = programData.partners.map((partner) => {
      const baseMiles = pts * partner.ratio;
      const bonusMiles = baseMiles * partner.bonus;
      const totalMiles = baseMiles + bonusMiles;

      return {
        airline: partner.airline,
        time: partner.time,
        bonus: partner.bonus,
        totalMiles,
      };
    });

    setTransferResults(results);
  };

  return (
    <div className="min-h-screen py-12 px-6 flex justify-center box-border">
      <div className="max-w-[900px] w-full flex flex-col gap-12">
        <header className="border-b-[12px] border-border pb-4">
          <h1 className="text-[clamp(3rem,7vw,5rem)] font-black tracking-tighter uppercase m-0 leading-[0.85]">
            Award<br />Architect
          </h1>
          <div className="font-mono text-sm font-bold tracking-[0.15em] mt-4 flex justify-between">
            <span>SYS.V6 // REAL_SEARCH_HANDOFF</span>
            <span>STATUS: READY</span>
          </div>
        </header>

        {/* SECTION 1: FLIGHT SEARCH */}
        <div className="bg-bg border-4 border-border p-6 sm:p-10 shadow-brutal flex flex-col gap-6">
          <h2 className="text-2xl sm:text-3xl font-black uppercase border-b-4 border-border pb-2 m-0">
            1. Route Intelligence
          </h2>
          <p className="font-mono text-xs leading-relaxed text-text/80 m-0">
            This builds a prefilled search on PointsYeah and opens it in a new tab —
            real award availability across the programs you select below, live from
            their data. This app does not host its own flight data.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Origin (IATA)</label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="JFK"
                maxLength={3}
                className="w-full bg-bg border-2 border-border p-4 font-mono text-base text-text box-border shadow-brutal-inset transition-all focus:outline-4 focus:outline-text focus:outline-offset-4"
              />
            </div>
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Destination (IATA)</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="LHR"
                maxLength={3}
                disabled={searchAnywhere}
                className="w-full bg-bg border-2 border-border p-4 font-mono text-base text-text box-border shadow-brutal-inset transition-all focus:outline-4 focus:outline-text focus:outline-offset-4 disabled:opacity-50"
              />
              <label className="flex items-center gap-2 mt-2 font-mono text-xs">
                <input type="checkbox" checked={searchAnywhere} onChange={(e) => setSearchAnywhere(e.target.checked)} />
                Search anywhere (explore mode)
              </label>
            </div>
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Search From</label>
              <input
                type="date"
                min={today}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-bg border-2 border-border p-4 font-mono text-base text-text box-border shadow-brutal-inset transition-all focus:outline-4 focus:outline-text focus:outline-offset-4"
              />
            </div>
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Search Through</label>
              <input
                type="date"
                min={startDate || today}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-bg border-2 border-border p-4 font-mono text-base text-text box-border shadow-brutal-inset transition-all focus:outline-4 focus:outline-text focus:outline-offset-4"
              />
            </div>
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Cabins</label>
              <div className="flex flex-wrap gap-3 font-mono text-xs">
                {CABINS.map(cabin => (
                  <label key={cabin} className="flex items-center gap-1">
                    <input type="checkbox" checked={selectedCabins.includes(cabin)} onChange={() => toggleCabin(cabin)} />
                    {cabin}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Loyalty Program (for AI tips)</label>
              <select
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className="w-full bg-bg border-2 border-border p-4 font-mono text-base text-text box-border shadow-brutal-inset transition-all focus:outline-4 focus:outline-text focus:outline-offset-4 appearance-none rounded-none"
              >
                <option value="United MileagePlus">United MileagePlus</option>
                <option value="Delta SkyMiles">Delta SkyMiles</option>
                <option value="American AAdvantage">American AAdvantage</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Programs to Search</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
              {PROGRAMS.map(p => (
                <label key={p.code} className="flex items-center gap-1">
                  <input type="checkbox" checked={selectedPrograms.includes(p.code)} onChange={() => toggleProgram(p.code)} />
                  {p.code} — {p.name}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 font-mono text-xs">
            <input type="checkbox" checked={weekendOnly} onChange={(e) => setWeekendOnly(e.target.checked)} />
            Weekend departures only
          </label>

          <button
            onClick={handleSearchFlights}
            disabled={isSearching}
            className="bg-text text-bg border-none p-5 font-sans text-lg font-black uppercase tracking-[0.1em] cursor-pointer shadow-brutal-btn transition-all w-full mt-4 flex justify-center items-center active:translate-x-[2px] active:translate-y-[2px] active:shadow-brutal-btn-active disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSearching ? 'OPENING REAL SEARCH...' : 'Search Real Award Availability'}
          </button>

          {searchError && (
            <div className="mt-4 p-4 border-2 border-red-600 bg-red-100 text-red-800 font-mono text-sm font-bold">
              {searchError}
            </div>
          )}

          {lastSearchUrl && (
            <div className="font-mono text-xs break-all border-2 border-border p-3 bg-[#d4d4d4]">
              Opened: <a href={lastSearchUrl} target="_blank" rel="noopener noreferrer" className="underline">{lastSearchUrl}</a>
            </div>
          )}

          {aiTips && (
            <div className="flex flex-col gap-4 mt-2">
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">AI Strategic Brief (general advice, not live data)</label>
              <div className="bg-[#d4d4d4] p-6 border-l-8 border-border font-mono text-sm leading-relaxed">
                <ul className="m-0 pl-5 list-disc">
                  {aiTips.map((tip, i) => (
                    <li key={i} className="mb-2">{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: POINTS TRANSFER CALCULATOR */}
        <div className="bg-bg border-4 border-border p-6 sm:p-10 shadow-brutal flex flex-col gap-6">
          <h2 className="text-2xl sm:text-3xl font-black uppercase border-b-4 border-border pb-2 m-0">
            2. Yield Calculator
          </h2>
          <p className="font-mono text-xs leading-relaxed text-text/80 m-0">
            Transfer ratios and bonuses below are hardcoded reference values and may
            drift out of date — verify current bonuses on each program's site before
            relying on this for a real transfer decision.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Credit Card Program</label>
              <select
                value={ccProgram}
                onChange={(e) => setCcProgram(e.target.value as keyof typeof transferData)}
                className="w-full bg-bg border-2 border-border p-4 font-mono text-base text-text box-border shadow-brutal-inset transition-all focus:outline-4 focus:outline-text focus:outline-offset-4 appearance-none rounded-none"
              >
                {Object.entries(transferData).map(([key, data]) => (
                  <option key={key} value={key}>{data.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Points to Transfer</label>
              <input
                type="number"
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
                placeholder="e.g. 50000"
                min="1000"
                className="w-full bg-bg border-2 border-border p-4 font-mono text-base text-text box-border shadow-brutal-inset transition-all focus:outline-4 focus:outline-text focus:outline-offset-4"
              />
            </div>
          </div>

          <button
            onClick={handleCalculateTransfer}
            className="bg-text text-bg border-none p-5 font-sans text-lg font-black uppercase tracking-[0.1em] cursor-pointer shadow-brutal-btn transition-all w-full mt-4 flex justify-center items-center active:translate-x-[2px] active:translate-y-[2px] active:shadow-brutal-btn-active"
          >
            Calculate Yield
          </button>

          {transferResults && (
            <div className="flex flex-col gap-4 mt-4">
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Transfer Network</label>
              <div className="flex flex-col gap-4">
                {transferResults.map((result, i) => (
                  <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border-2 border-border font-mono bg-bg gap-2 sm:gap-0">
                    <div>
                      <strong>{result.airline}</strong><br />
                      Time: {result.time}
                      {result.bonus > 0 && (
                        <><br /><span className="bg-text text-bg px-2 py-1 text-[0.7rem] font-bold mt-1 inline-block">{result.bonus * 100}% TRANSFER BONUS</span></>
                      )}
                    </div>
                    <div className="text-xl font-bold sm:text-right">
                      {result.totalMiles.toLocaleString()} MI
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
