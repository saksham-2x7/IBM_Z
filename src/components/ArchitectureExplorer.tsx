import React, { useState } from 'react';
import { Layers, Cpu, ShieldCheck, Database, Stethoscope, ArrowRight, CheckCircle2, ChevronRight, Server, Key } from 'lucide-react';

interface ArchitectureNode {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  tier: string;
  badge: string;
  specs: string[];
  description: string;
  ibmAdvantage: string;
}

const ARCHITECTURE_NODES: ArchitectureNode[] = [
  {
    id: 'layer-1',
    title: 'Bedside ICU Telemetry Ingestion',
    subtitle: 'HL7 / FHIR / IEEE 11073 Streaming Gateway',
    icon: Stethoscope,
    tier: 'Tier 1: Edge & Ingestion',
    badge: '120,000 msg/s',
    specs: ['IEEE 11073-10404 Vital Signs Protocol', '100 Hz continuous arterial & ECG waveforms', 'Zero-loss buffering via Kafka/AMQP streaming'],
    description: 'High-frequency telemetry from multi-bed patient monitors (Arterial line, ECG Lead II, pulse oximetry, capnography, and point-of-care arterial blood gases) streams into the hospital core network.',
    ibmAdvantage: 'Direct fiber connectivity into IBM Z I/O channels (FICON/PCIe) eliminates TCP packet drop bottlenecks experienced on commercial cloud load balancers.',
  },
  {
    id: 'layer-2',
    title: 'IBM z/OS In-Transaction Pipeline',
    subtitle: 'Core Mainframe High-Throughput Processing',
    icon: Server,
    tier: 'Tier 2: Enterprise Transaction Engine',
    badge: 'Parallel Sysplex 99.999%',
    specs: ['z/OS Transaction Engine with zero downtime', 'Pervasive Encryption (CPACF hardware crypto)', 'Microsecond message routing across LPAR partitions'],
    description: 'Processes streaming physiological records as mission-critical enterprise transactions. Each packet is cryptographically authenticated and routed directly to the AI co-processor before writing to storage.',
    ibmAdvantage: 'Eliminates batch buffering. Normal hospital cloud architectures batch data in 15-minute intervals; IBM Z evaluates every single heartbeat in-flight.',
  },
  {
    id: 'layer-3',
    title: 'IBM Z Telum II On-Chip AI Accelerator',
    subtitle: 'Integrated Hardware Neural Co-Processor',
    icon: Cpu,
    tier: 'Tier 3: Hardware AI Acceleration',
    badge: 'Target runtime: ONNX / zDLC',
    specs: ['Direct access to shared 32MB L2 & 256MB L3 cache', '32+ TeraFLOPS matrix acceleration per core', 'ONNX Runtime & PyTorch direct compilation'],
    description: 'Executes the multi-modal Temporal Transformer and Conformal Risk Engine directly on the silicon die where transactions reside, achieving sub-2 millisecond inference latency.',
    ibmAdvantage: 'No external GPU bus (PCIe bottlenecks), no TCP/IP hops, no serialization latency. Real-time inference executes at wire speed.',
  },
  {
    id: 'layer-4',
    title: 'LinuxONE Secure Execution Enclave',
    subtitle: 'Confidential Computing & Zero-Egress Memory',
    icon: ShieldCheck,
    tier: 'Tier 4: Enterprise Trust & Compliance',
    badge: 'HIPAA & GDPR Enclave',
    specs: ['Hardware-enforced memory isolation from hypervisor', 'Post-Quantum Safe Kyber/Dilithium cryptography', 'Differential Privacy guarantee (epsilon <= 0.5)'],
    description: 'All patient Protected Health Information (PHI) and clinical model weights reside inside encrypted memory spaces that even hospital system administrators cannot inspect or dump.',
    ibmAdvantage: 'Guarantees absolute data sovereignty. Zero data egress to third-party cloud vendors eliminates multi-million-dollar HIPAA data breach liabilities.',
  },
  {
    id: 'layer-5',
    title: 'Clinical Decision Support & EHR Interceptor',
    subtitle: 'Epic Systems / Cerner Integration & Clinician Paging',
    icon: Database,
    tier: 'Tier 5: Bedside Action & EHR Integration',
    badge: 'Sub-Second Paging',
    specs: ['SMART on FHIR API integration', 'Automated early warning paging to Rapid Response Teams', 'Counterfactual intervention recommendations'],
    description: 'Delivers actionable, explainable triage warnings to intensivist workstations and mobile pagers 6 hours prior to shock, equipped with automated SOFA scores and counterfactual titration models.',
    ibmAdvantage: 'Closes the loop from raw physiological sensor telemetry to bedside physician intervention within a single enterprise mainframe umbrella.',
  },
];

export const ArchitectureExplorer: React.FC = () => {
  const [activeNodeId, setActiveNodeId] = useState<string>('layer-3');
  const activeNode = ARCHITECTURE_NODES.find((n) => n.id === activeNodeId) || ARCHITECTURE_NODES[2];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="rounded bg-cyan-950 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-400 border border-cyan-800/50">
            ENTERPRISE BLUEPRINT
          </span>
          <span className="text-xs text-slate-400">IBM Z & LinuxONE Architecture</span>
        </div>
        <h2 className="mt-2 text-2xl font-bold font-mono text-white">
          AuraZ Enterprise Pipeline & Hardware Integration
        </h2>
        <p className="mt-1 text-sm text-slate-400 max-w-3xl">
          Click any layer below to explore how AuraZ harnesses IBM Z Telum II on-chip acceleration and LinuxONE Secure Execution to achieve zero-egress, sub-millisecond clinical preemption.
        </p>
      </div>

      {/* Interactive Architecture Flow */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 font-mono">
        {ARCHITECTURE_NODES.map((node, index) => {
          const Icon = node.icon;
          const isActive = node.id === activeNodeId;

          return (
            <button
              key={node.id}
              onClick={() => setActiveNodeId(node.id)}
              className={`relative flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                isActive
                  ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-400/50'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  0{index + 1}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${isActive ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  {node.badge}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <h4 className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                  {node.title}
                </h4>
              </div>

              <p className="mt-2 text-[10px] text-slate-400 line-clamp-2 font-sans">
                {node.subtitle}
              </p>

              {isActive && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Node Deep Dive */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 backdrop-blur font-mono">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-400/30">
              <activeNode.icon className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-cyan-400 font-bold">{activeNode.tier}</span>
              <h3 className="text-xl font-bold text-white">{activeNode.title}</h3>
              <p className="text-xs text-slate-400">{activeNode.subtitle}</p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-950 px-4 py-2 border border-slate-800 text-right">
            <div className="text-[10px] text-slate-500">SYSTEM BENCHMARK</div>
            <div className="text-base font-bold text-emerald-400">{activeNode.badge}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Technical Specifications & Protocols
              </h4>
              <div className="space-y-2">
                {activeNode.specs.map((spec, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{spec}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Operational Role in AuraZ
              </h4>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                {activeNode.description}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-800/40 bg-gradient-to-br from-cyan-950/30 to-slate-950 p-5">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold mb-2">
              <ShieldCheck className="h-4 w-4" />
              <span>THE IBM ENTERPRISE MAINFRAME ADVANTAGE</span>
            </div>
            <p className="text-xs text-slate-200 font-sans leading-relaxed">
              {activeNode.ibmAdvantage}
            </p>

            <div className="mt-4 pt-4 border-t border-cyan-900/40 flex items-center justify-between text-[11px] text-cyan-300/80">
              <span>Hardware-Verified Pipeline</span>
              <span>IBM Z / LinuxONE Ecosystem</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
