import React, { useState, useEffect } from 'react';
import { Patient } from './types';
import { INITIAL_PATIENTS } from './mockData';
import { Header } from './components/Header';
import { LiveICUMonitor } from './components/LiveICUMonitor';
import { PatientDetailModal } from './components/PatientDetailModal';
import { BenchmarkLab } from './components/BenchmarkLab';
import { CounterfactualSimulator } from './components/CounterfactualSimulator';
import { ArchitectureExplorer } from './components/ArchitectureExplorer';
import { SubmissionHub } from './components/SubmissionHub';
import { ReplayLab } from './components/ReplayLab';
import { ValidationPanel } from './components/ValidationPanel';
import { useArtifacts } from './lib/model';

const Loading = () => <div className="p-10 text-center font-mono text-slate-500">Loading model…</div>;

export const App: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>(INITIAL_PATIENTS);
  const art = useArtifacts();
  const [activeTab, setActiveTab] = useState<'monitor' | 'replay' | 'validation' | 'benchmark' | 'counterfactual' | 'architecture' | 'submission'>('replay');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [interventionPatientId, setInterventionPatientId] = useState<string>('PT-8942');

  // Subtle real-time vital signs fluctuation to simulate live physiological stream
  useEffect(() => {
    const interval = setInterval(() => {
      setPatients((prevPatients) =>
        prevPatients.map((patient) => {
          // slight stochastic jitter on vitals
          const hrJitter = Math.floor(Math.random() * 3) - 1;
          const mapJitter = Math.floor(Math.random() * 3) - 1;
          const newHr = Math.max(50, Math.min(160, patient.vitals.heartRate + hrJitter));
          const newMap = Math.max(45, Math.min(110, patient.vitals.map + mapJitter));
          const newShockIndex = +(newHr / patient.vitals.sbp).toFixed(2);

          return {
            ...patient,
            vitals: {
              ...patient.vitals,
              heartRate: newHr,
              map: newMap,
              shockIndex: newShockIndex,
            },
          };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const criticalCount = patients.filter((p) => p.status === 'critical').length;

  const handleOpenIntervention = (patient: Patient) => {
    setInterventionPatientId(patient.id);
    setActiveTab('counterfactual');
  };

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        criticalAlertCount={criticalCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'monitor' && (
          <LiveICUMonitor
            patients={patients}
            onSelectPatient={(p) => setSelectedPatient(p)}
            onOpenIntervention={handleOpenIntervention}
          />
        )}

        {activeTab === 'replay' && (art ? <ReplayLab model={art.model} patients={art.replay} /> : <Loading />)}
        {activeTab === 'validation' && (art ? <ValidationPanel m={art.metrics} /> : <Loading />)}
        {activeTab === 'benchmark' && (art ? <BenchmarkLab model={art.model} patients={art.replay} /> : <Loading />)}

        {activeTab === 'counterfactual' && (
          <CounterfactualSimulator
            patients={patients}
            selectedPatientId={interventionPatientId}
          />
        )}

        {activeTab === 'architecture' && <ArchitectureExplorer />}

        {activeTab === 'submission' && <SubmissionHub />}
      </main>

      {/* Patient Detail Modal */}
      <PatientDetailModal
        patient={selectedPatient}
        onClose={() => setSelectedPatient(null)}
        onOpenIntervention={handleOpenIntervention}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#040609] py-4 px-6 text-center text-xs font-mono text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          <span>AuraZ Clinical Preemption Engine // Prototype · simulated cohort · IBM Z target architecture</span>
        </div>
        <div className="text-slate-400">
          IBM Z Datathon 2026 • Technology for Good • Not a medical device
        </div>
      </footer>
    </div>
  );
};

export default App;
