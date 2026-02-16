import { Routes, Route } from 'react-router-dom';
import HomePage from './ui/pages/HomePage';
import TerminalPage from './ui/pages/TerminalPage';
import SettingsPage from './ui/pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/terminal/:id" element={<TerminalPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
