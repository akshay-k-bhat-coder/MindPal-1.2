import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { AuthForm } from './components/auth/AuthForm';
import { Layout } from './components/Layout';
import { Dashboard } from './components/dashboard/Dashboard';
import { TaskManager } from './components/tasks/TaskManager';
import { MoodTracker } from './components/mood/MoodTracker';
import { VoiceAI } from './components/voice/VoiceAI';
import { VideoConsultation } from './components/video/VideoConsultation';
import { Settings } from './components/settings/Settings';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthForm />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="tasks" element={<TaskManager />} />
            <Route path="mood" element={<MoodTracker />} />
            <Route path="voice" element={<VoiceAI />} />
            <Route path="video" element={<VideoConsultation />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
        <Toaster position="top-right" />
      </div>
    </Router>
  );
}

export default App;