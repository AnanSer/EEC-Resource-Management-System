import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import FoundationPage from './pages/FoundationPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FoundationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
