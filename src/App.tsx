/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export default function App() {
  const [today, setToday] = useState('');

  // Route Intelligence State
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [depDate, setDepDate] = useState('');
  const [program, setProgram] = useState('United MileagePlus');
  const [isSearching, setIsSearching] = useState(false);
  const [flightResults, setFlightResults] = useState<{ airline: string; route: string; date: string; points: number; taxes: string }[] | null>(null);
  const [aiTips, setAiTips] = useState<string[] | null>(null);
  const [searchError, setSearchError] = useState('');

  // Yield Calculator State
  const [ccProgram, setCcProgram] = useState<keyof typeof transferData>('chase_ur');
  const [pointsAmount, setPointsAmount] = useState<string>('');
  const [transferResults, setTransferResults] = useState<{ airline: string; time: string; bonus: number; totalMiles: number }[] | null>(null);

  useEffect(() => {
    const d = new Date().toISOString().split('T')[0];
    setToday(d);
    setDepDate(d);
  }, []);

  const handleSearchFlights = async () => {
    const o = origin || 'JFK';
    const d = destination || 'LHR';
    
    setIsSearching(true);
    setSearchError('');
    setFlightResults(null);
    setAiTips(null);

    try {
      // A. Generate Mock Flights
      const mockFlights = [
        { airline: program.split(' ')[0] + ' Airlines', route: `${o} -> ${d}`, date: depDate, points: 30000, taxes: '$5.60' },
        { airline: 'Partner Airline', route: `${o} -> ${d} (1 Stop)`, date: depDate, points: 25000, taxes: '$45.00' },
      ];

      // B. Gemini API Call
      const prompt = `I am flying from ${o} to ${d} on ${depDate} using ${program} points. Provide exactly 3 short, highly strategic tips for maximizing award travel on this specific route. Return the response as a strict JSON array of strings.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          temperature: 0.4,
        },
      });

      const tipsArray = JSON.parse(response.text || '[]');

      setFlightResults(mockFlights);
      setAiTips(tipsArray);
    } catch (err: any) {
      setSearchError(`SYS.ERROR: ${err.message || 'Failed to fetch AI strategy.'}`);
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
            <span>SYS.V4 // CLIENT_SIDE_MODE</span>
            <span>STATUS: READY</span>
          </div>
        </header>

        {/* SECTION 1: FLIGHT SEARCH */}
        <div className="bg-bg border-4 border-border p-6 sm:p-10 shadow-brutal flex flex-col gap-6">
          <h2 className="text-2xl sm:text-3xl font-black uppercase border-b-4 border-border pb-2 m-0">
            1. Route Intelligence
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Origin</label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="JFK"
                className="w-full bg-bg border-2 border-border p-4 font-mono text-base text-text box-border shadow-brutal-inset transition-all focus:outline-4 focus:outline-text focus:outline-offset-4"
              />
            </div>
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Destination</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="LHR"
                className="w-full bg-bg border-2 border-border p-4 font-mono text-base text-text box-border shadow-brutal-inset transition-all focus:outline-4 focus:outline-text focus:outline-offset-4"
              />
            </div>
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Departure</label>
              <input
                type="date"
                min={today}
                value={depDate}
                onChange={(e) => setDepDate(e.target.value)}
                className="w-full bg-bg border-2 border-border p-4 font-mono text-base text-text box-border shadow-brutal-inset transition-all focus:outline-4 focus:outline-text focus:outline-offset-4"
              />
            </div>
            <div>
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Loyalty Program</label>
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
          
          <button
            onClick={handleSearchFlights}
            disabled={isSearching}
            className="bg-text text-bg border-none p-5 font-sans text-lg font-black uppercase tracking-[0.1em] cursor-pointer shadow-brutal-btn transition-all w-full mt-4 flex justify-center items-center active:translate-x-[2px] active:translate-y-[2px] active:shadow-brutal-btn-active disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSearching ? 'PROCESSING REQUEST...' : 'Execute Search'}
          </button>

          {searchError && (
            <div className="mt-4 p-4 border-2 border-red-600 bg-red-100 text-red-800 font-mono text-sm font-bold">
              {searchError}
            </div>
          )}

          {flightResults && aiTips && (
            <div className="flex flex-col gap-4 mt-4">
              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mb-2">Simulated Award Availability</label>
              <div className="flex flex-col gap-4">
                {flightResults.map((f, i) => (
                  <div key={i} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border-2 border-border font-mono bg-bg gap-2 sm:gap-0">
                    <div>
                      <strong>{f.airline}</strong><br />
                      {f.route} | {f.date}
                    </div>
                    <div className="text-xl font-bold sm:text-right">
                      {f.points.toLocaleString()} PTS<br />
                      <span className="text-xs font-normal">{f.taxes}</span>
                    </div>
                  </div>
                ))}
              </div>

              <label className="block font-black text-[0.85rem] uppercase tracking-[0.1em] border-b-2 border-border pb-1 w-max mt-4 mb-2">AI Strategic Brief</label>
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
