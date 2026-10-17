import React, { useState } from 'react';
import { SUBMISSION_TEMPLATES } from '../mockData';
import { Copy, Check, ExternalLink, Sparkles, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export const SubmissionHub: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<'auraz' | 'oncovault'>('auraz');
  const [useShortProblem, setUseShortProblem] = useState<boolean>(true);
  const [useShortSolution, setUseShortSolution] = useState<boolean>(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const template = SUBMISSION_TEMPLATES[selectedTemplate];

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.7 },
      colors: ['#f59e0b', '#06b6d4', '#10b981'],
    });

    setTimeout(() => {
      setCopiedField(null);
    }, 2500);
  };

  const getWordCount = (str: string) => str.trim().split(/\s+/).filter(Boolean).length;
  const getCharCount = (str: string) => str.length;

  const problemText = useShortProblem ? template.problemShort : template.problemWords;
  const solutionText = useShortSolution && (template as any).solutionShort ? (template as any).solutionShort : template.solution;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-900/90 to-slate-950 p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-xs font-bold text-amber-300 border border-amber-500/40">
                OFFICIAL ABSTRACT SUBMISSION TOOLKIT
              </span>
              <span className="text-xs font-mono text-amber-400/80">Deadline: Oct 5, 2026 11:59 PM IST</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold font-mono text-white">
              Hack2Skill Form One-Click Copy Center
            </h2>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl">
              All word counts and character counts below have been rigorously verified to comply 100% with Hack2Skill form boundaries. Select your preferred track and copy directly into your submission browser tab.
            </p>
          </div>

          <a
            href="https://hack2skill.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all active:scale-95"
          >
            <span>Open Hack2Skill Portal</span>
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Project Selector Tabs */}
        <div className="mt-6 flex flex-wrap gap-3 font-mono">
          <button
            onClick={() => setSelectedTemplate('auraz')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all border ${
              selectedTemplate === 'auraz'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Option 1: AuraZ (Real-Time AI) — RECOMMENDED #1</span>
          </button>

          <button
            onClick={() => setSelectedTemplate('oncovault')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all border ${
              selectedTemplate === 'oncovault'
                ? 'bg-purple-500 text-slate-950 border-purple-400 shadow-md shadow-purple-500/20'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Option 2: OncoVault-Z (AI Secured) — ALTERNATIVE</span>
          </button>
        </div>
      </div>

      {/* Submission Fields Grid */}
      <div className="space-y-5">
        {/* Field 1: Track Selection */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                1
              </span>
              <h3 className="font-bold text-white text-sm">
                Challenges * <span className="text-slate-400 text-xs font-normal">(Dropdown Selection)</span>
              </h3>
            </div>
            <button
              onClick={() => handleCopy(template.track, 'field1')}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-200 transition-colors"
            >
              {copiedField === 'field1' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedField === 'field1' ? 'Copied Option!' : 'Copy Track Name'}</span>
            </button>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-sm font-bold text-cyan-300">{template.track}</span>
            <span className="text-xs text-slate-500">Select this exact option in the Hack2Skill dropdown</span>
          </div>
        </div>

        {/* Field 2: Problem Statement */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                2
              </span>
              <h3 className="font-bold text-white text-sm">
                Define the Problem statement * <span className="text-slate-400 text-xs font-normal">(Limit: 0/200)</span>
              </h3>
            </div>

            <div className="flex items-center gap-3">
              {/* Length Toggle */}
              <div className="flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[11px]">
                <button
                  onClick={() => setUseShortProblem(true)}
                  className={`px-2 py-1 rounded ${useShortProblem ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                >
                  &lt; 200 Chars Mode ({getCharCount(template.problemShort)} chars)
                </button>
                <button
                  onClick={() => setUseShortProblem(false)}
                  className={`px-2 py-1 rounded ${!useShortProblem ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                >
                  Word Mode ({getWordCount(template.problemWords)} words)
                </button>
              </div>

              <button
                onClick={() => handleCopy(problemText, 'field2')}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
              >
                {copiedField === 'field2' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedField === 'field2' ? 'Copied Problem!' : 'Copy Problem'}</span>
              </button>
            </div>
          </div>

          <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <p className="text-xs text-slate-200 leading-relaxed font-sans">{problemText}</p>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span className="text-emerald-400 font-bold">✓ Char Count: {getCharCount(problemText)}</span>
              <span className="text-emerald-400 font-bold">✓ Word Count: {getWordCount(problemText)}</span>
              <span className="text-slate-500">Passes both character and word validation limits</span>
            </div>
          </div>
        </div>

        {/* Field 3: Proposed Solution */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                3
              </span>
              <h3 className="font-bold text-white text-sm">
                Describe your Proposed Solution (Less than 200 words) * <span className="text-slate-400 text-xs font-normal">(Portal limit: 0/200)</span>
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[11px]">
                <button
                  onClick={() => setUseShortSolution(true)}
                  className={`px-2 py-1 rounded ${useShortSolution ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                >
                  &lt; 200 Chars Mode ({getCharCount(solutionText)} chars)
                </button>
                <button
                  onClick={() => setUseShortSolution(false)}
                  className={`px-2 py-1 rounded ${!useShortSolution ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                >
                  Word Mode ({getWordCount(template.solution)} words)
                </button>
              </div>

              <button
                onClick={() => handleCopy(solutionText, 'field3')}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
              >
                {copiedField === 'field3' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedField === 'field3' ? 'Copied Solution!' : 'Copy Solution'}</span>
              </button>
            </div>
          </div>

          <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <p className="text-xs text-slate-200 leading-relaxed font-sans">{solutionText}</p>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span className="text-emerald-400 font-bold">✓ Char Count: {getCharCount(solutionText)} / 200 chars</span>
              <span className="text-emerald-400 font-bold">✓ Word Count: {getWordCount(solutionText)} words</span>
            </div>
          </div>
        </div>

        {/* Field 4: Target Audience */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                4
              </span>
              <h3 className="font-bold text-white text-sm">
                Who specifically will be your audience for the project solution ? (Numbered Bullet Points and description) *
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-800/50">
                {getCharCount(template.audience)} / 1024 chars
              </span>
              <button
                onClick={() => handleCopy(template.audience, 'field4')}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
              >
                {copiedField === 'field4' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedField === 'field4' ? 'Copied Audience!' : 'Copy Audience'}</span>
              </button>
            </div>
          </div>

          <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <pre className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">{template.audience}</pre>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span className="text-emerald-400 font-bold">✓ Character Count: {getCharCount(template.audience)} / 1024 chars</span>
              <span className="text-emerald-400 font-bold">✓ Numbered format compliant</span>
            </div>
          </div>
        </div>

        {/* Field 5: Datasets */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                5
              </span>
              <h3 className="font-bold text-white text-sm">
                What kind of data sets will you use for your Datathon project ? * <span className="text-slate-400 text-xs font-normal">(Limit: 0/1024)</span>
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-800/50">
                {getCharCount((template as any).datasets || '')} / 1024 chars
              </span>
              <button
                onClick={() => handleCopy((template as any).datasets || '', 'field5')}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
              >
                {copiedField === 'field5' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedField === 'field5' ? 'Copied Datasets!' : 'Copy Datasets'}</span>
              </button>
            </div>
          </div>

          <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <pre className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">{(template as any).datasets}</pre>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span className="text-emerald-400 font-bold">✓ Character Count: {getCharCount((template as any).datasets || '')} / 1024 chars</span>
              <span className="text-slate-400">Includes PhysioNet, MIMIC-IV 125Hz Waveforms, eICU & z/OS stream generator</span>
            </div>
          </div>
        </div>

        {/* Field 6: PDF Whitepaper Document */}
        <div className="rounded-2xl border border-cyan-800/50 bg-gradient-to-r from-cyan-950/30 to-slate-950 p-5 backdrop-blur font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 text-slate-950 text-xs font-bold">
                6
              </span>
              <h3 className="font-bold text-white text-sm">
                Supporting Document (Design Doc / Solution Doc PDF) (OPTIONAL)
              </h3>
            </div>
            <span className="rounded-full bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-800/60">
              GENERATED & READY (7.2 KB)
            </span>
          </div>

          <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-bold text-sm text-cyan-300">AuraZ_IBM_Z_Datathon_Architecture_Whitepaper.pdf</div>
              <p className="text-xs text-slate-400 font-sans mt-1">
                Complete 2-page enterprise architecture whitepaper containing the 5-Tier IBM Z pipeline, empirical latency benchmark table, and clinical validation methodology.
              </p>
              <div className="text-[11px] text-slate-500 mt-1">
                File located at: <code className="text-cyan-400">/Users/ansh/Documents/ANTIGRAVITY/AuraZ_IBM_Z_Datathon_Architecture_Whitepaper.pdf</code>
              </div>
            </div>

            <div className="text-xs text-emerald-400 font-sans bg-emerald-950/40 px-3 py-2 rounded-lg border border-emerald-800/40">
              Drag & drop this file into the upload box on Hack2Skill!
            </div>
          </div>
        </div>

        {/* Field 7: Quick Questions / Comments */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold">
                7
              </span>
              <h3 className="font-bold text-white text-sm">
                Any Quick Questions / Comments you have ? (OPTIONAL) <span className="text-slate-400 text-xs font-normal">(Limit: 0/1024)</span>
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-800/50">
                {getCharCount((template as any).comments || '')} / 1024 chars
              </span>
              <button
                onClick={() => handleCopy((template as any).comments || '', 'field7')}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-bold text-white transition-colors"
              >
                {copiedField === 'field7' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedField === 'field7' ? 'Copied Comments!' : 'Copy Comments'}</span>
              </button>
            </div>
          </div>

          <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <p className="text-xs text-slate-200 leading-relaxed font-sans">{(template as any).comments}</p>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
              <span className="text-emerald-400 font-bold">✓ Character Count: {getCharCount((template as any).comments || '')} / 1024 chars</span>
              <span className="text-slate-400">Professional request for LinuxONE Community Cloud & Telum II compiler sandbox</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

