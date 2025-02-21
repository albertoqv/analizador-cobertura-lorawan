"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = () => {
    if (password === "Xx9$gT!7mP@vQ3zK#f") { // Cambia esta contraseña si lo deseas
      sessionStorage.setItem("password", password); // Guarda la sesión
      router.push("/"); // Redirige a la página principal donde está el mapa
    } else {
      setError("Contraseña incorrecta");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-4">Acceso</h1>
      <input
        type="password"
        placeholder="Introduce la contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 rounded mb-2"
      />
      <button
        onClick={handleLogin}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Entrar
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  );
}
