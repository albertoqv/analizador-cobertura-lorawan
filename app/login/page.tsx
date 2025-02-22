"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();

  const handleLogin = () => {
    if (password === "Xx9$gT!7mP@vQ3zK#f") {
      sessionStorage.setItem("password", password);
      router.push("/");
    } else {
      setError("⚠️ Acceso denegado: Contraseña incorrecta.");
      setTimeout(() => setError(""), 3000); // Borra el mensaje después de 3 segundos
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-screen bg-gradient-to-br from-black to-gray-900 text-white overflow-hidden">
      
      {/* Partículas fijas con posiciones más predecibles */}
      <div className="absolute top-[15%] left-[10%] w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      <div className="absolute top-[20%] right-[12%] w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
      <div className="absolute bottom-[15%] left-[18%] w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
      <div className="absolute bottom-[10%] right-[20%] w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
      <div className="absolute top-[50%] left-[5%] w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
      <div className="absolute bottom-[30%] right-[5%] w-2 h-2 bg-red-500 rounded-full animate-ping"></div>

      {/* Título corregido con margen fijo */}
      <h1 className="text-4xl font-mono tracking-widest text-gray-300 mt-[-100px] drop-shadow-lg animate-pulse">
        Mapa de Cobertura <span className="text-blue-500">LoRaWAN</span>
      </h1>

      {/* Caja de login flotante */}
      <div className="relative w-80 mt-4">
        <input
          type="password"
          placeholder={isFocused ? "" : "Introduce la contraseña"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(password.length > 0)}
          className="w-full p-3 text-lg bg-black border border-gray-600 text-green-400 tracking-wide 
                     focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
        />

        {/* Botón futurista */}
        <div className="relative flex justify-center mt-6">
          <button
            onClick={handleLogin}
            className="relative px-8 py-3 font-mono text-lg text-white uppercase tracking-wider
                       bg-blue-600 border border-blue-400 shadow-lg rounded-md
                       hover:bg-blue-500 hover:border-blue-300 hover:scale-105
                       transition-all duration-300"
          >
            ACCEDER
          </button>
        </div>

        {/* Mensaje de error animado */}
        {error && (
          <p className="text-red-500 text-center mt-3 animate-bounce">{error}</p>
        )}
      </div>
    </div>
  );
}
