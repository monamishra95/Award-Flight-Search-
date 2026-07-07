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
      setSearchError('Origin airport code is required.');
      return;
    }
    if (selectedPrograms.length === 0) {
      setSearchError('Select at least one loyalty program.');
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
      setSearchError(`AI tips unavailable (PointsYeah search still opened): ${err.message || 'Failed to fetch AI strategy.'}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCalculateTransfer = () => {
    const pts = Number(pointsAmount);
    if (!pts || pts < 1000) {
      alert('Enter a valid point value (minimum 1,000).');
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

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition placeholder-gray-300";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="min-h-screen py-10 px-4 flex justify-center" style={{ backgroundColor: '#f0f4f8' }}>
      <div className="max-w-3xl w-full flex flex-col gap-6">

        {/* Header */}
        <header className="px-1 pt-2 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg" style={{ backgroundColor: '#4f46e5' }}>
              ✈
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Award Architect</h1>
          </div>
          <p className="text-gray-400 text-sm ml-12">
            Real award search via PointsYeah · AI strategy tips · Points yield calculator
          </p>
        </header>

        {/* SECTION 1: FLIGHT SEARCH */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 flex flex-col gap-6">

          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#4f46e5' }}>1</span>
              <h2 className="text-base font-semibold text-gray-900">Route Intelligence</h2>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed ml-8">
              Builds a prefilled search on PointsYeah and opens it in a new tab —
              real award availability across the programs you select. This app does not host its own flight data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Origin (IATA)</label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="JFK"
                maxLength={3}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Destination (IATA)</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="LHR"
                maxLength={3}
                disabled={searchAnywhere}
                className={inputClass + ' disabled:opacity-40 disabled:bg-gray-50'}
              />
              <label className="flex items-center gap-2 mt-2 text-xs text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={searchAnywhere}
                  onChange={(e) => setSearchAnywhere(e.target.checked)}
                  style={{ accentColor: '#4f46e5' }}
                />
                Search anywhere (explore mode)
              </label>
            </div>
            <div>
              <label className={labelClass}>Search From</label>
              <input
                type="date"
                min={today}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Search Through</label>
              <input
                type="date"
                min={startDate || today}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Cabins</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CABINS.map(cabin => (
                  <button
                    key={cabin}
                    type="button"
                    onClick={() => toggleCabin(cabin)}
                    className="px-3 py-1.5 rounded-full border text-xs font-medium transition-all"
                    style={selectedCabins.includes(cabin)
                      ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: '#ffffff' }
                      : { backgroundColor: '#ffffff', borderColor: '#e5e7eb', color: '#6b7280' }
                    }
                  >
                    {cabin}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Loyalty Program (for AI tips)</label>
              <select
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                className={inputClass}
              >
                <option value="United MileagePlus">United MileagePlus</option>
                <option value="Delta SkyMiles">Delta SkyMiles</option>
                <option value="American AAdvantage">American AAdvantage</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass + ' mb-0'}>Programs to Search</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPrograms(PROGRAMS.map(p => p.code))}
                  className="text-xs font-medium"
                  style={{ color: '#4f46e5' }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPrograms([])}
                  className="text-xs font-medium text-gray-300"
                >
                  Clear all
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PROGRAMS.map(p => (
                <label
                  key={p.code}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all"
                  style={selectedPrograms.includes(p.code)
                    ? { backgroundColor: '#eef2ff', borderColor: '#c7d2fe', color: '#3730a3' }
                    : { backgroundColor: '#fafafa', borderColor: '#f3f4f6', color: '#9ca3af' }
                  }
                >
                  <input
                    type="checkbox"
                    checked={selectedPrograms.includes(p.code)}
                    onChange={() => toggleProgram(p.code)}
                    className="hidden"
                  />
                  <span className="font-mono font-bold text-[10px] opacity-60 flex-shrink-0">{p.code}</span>
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={weekendOnly}
              onChange={(e) => setWeekendOnly(e.target.checked)}
              style={{ accentColor: '#4f46e5' }}
            />
            Weekend departures only
          </label>

          <button
            onClick={handleSearchFlights}
            disabled={isSearching}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: isSearching ? '#818cf8' : '#4f46e5' }}
          >
            {isSearching ? 'Opening search on PointsYeah...' : 'Search Real Award Availability →'}
          </button>

          {searchError && (
            <div className="p-4 rounded-xl text-sm text-red-600" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
              {searchError}
            </div>
          )}

          {lastSearchUrl && (
            <p className="text-xs text-gray-300 break-all">
              Opened:{' '}
              <a href={lastSearchUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#818cf8' }}>
                {lastSearchUrl}
              </a>
            </p>
          )}

          {aiTips && (
            <div className="rounded-xl p-5" style={{ backgroundColor: '#eef2ff', border: '1px solid #c7d2fe' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#6366f1' }}>
                AI Strategic Brief · General advice, not live data
              </p>
              <ol className="flex flex-col gap-2.5 list-none m-0 p-0">
                {aiTips.map((tip, i) => (
                  <li key={i} className="flex gap-3 text-sm" style={{ color: '#374151' }}>
                    <span className="font-bold flex-shrink-0" style={{ color: '#818cf8' }}>{i + 1}.</span>
                    {tip}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* SECTION 2: POINTS TRANSFER CALCULATOR */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 flex flex-col gap-6">

          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: '#f59e0b' }}>2</span>
              <h2 className="text-base font-semibold text-gray-900">Yield Calculator</h2>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed ml-8">
              Transfer ratios and bonuses are hardcoded reference values — verify current bonuses on each program's site before a real transfer.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Credit Card Program</label>
              <select
                value={ccProgram}
                onChange={(e) => setCcProgram(e.target.value as keyof typeof transferData)}
                className={inputClass}
              >
                {Object.entries(transferData).map(([key, data]) => (
                  <option key={key} value={key}>{data.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Points to Transfer</label>
              <input
                type="number"
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
                placeholder="e.g. 50000"
                min="1000"
                className={inputClass}
              />
            </div>
          </div>

          <button
            onClick={handleCalculateTransfer}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all"
            style={{ backgroundColor: '#f59e0b' }}
          >
            Calculate Transfer Yield →
          </button>

          {transferResults && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-gray-600">Transfer Network</p>
              {transferResults.map((result, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-4 rounded-xl"
                  style={{ backgroundColor: '#fafafa', border: '1px solid #f3f4f6' }}
                >
                  <div>
                    <p className="font-medium text-sm text-gray-900">{result.airline}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Transfer time: {result.time}</p>
                    {result.bonus > 0 && (
                      <span
                        className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                      >
                        +{result.bonus * 100}% BONUS
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">{result.totalMiles.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">miles</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="text-center text-xs text-gray-300 pb-6">
          Award Architect · Personal-use demo · Real search powered by{' '}
          <a href="https://www.pointsyeah.com" target="_blank" rel="noopener noreferrer" className="underline">
            PointsYeah
          </a>
        </footer>

      </div>
    </div>
  );
}
