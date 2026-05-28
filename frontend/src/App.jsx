import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalProvider } from './GlobalContext';
import Login from './Login';
import Layout from './Layout';
import Dashboard from './Dashboard';
import Obras from './Obras';
import Obreros from './Obreros';
import Asistencia from './Asistencia';
import Proveedores from './Proveedores';
import Comprobantes from './Comprobantes';
import { Toaster } from 'react-hot-toast';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('etem_token');
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <GlobalProvider>
      <Toaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="obras" element={<Obras />} />
            <Route path="obreros" element={<Obreros />} />
            <Route path="asistencia" element={<Asistencia />} />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="comprobantes" element={<Comprobantes />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GlobalProvider>
  );
}

export default App;
