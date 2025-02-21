"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MapboxMap = dynamic(() => import("../components/map/Map"), { ssr: false });

const Home = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const password = sessionStorage.getItem("password");
    if (password !== "Xx9$gT!7mP@vQ3zK#f") { // Asegúrate de que coincida con la contraseña de login.tsx
      router.push("/login");
    } else {
      setAuthenticated(true);
    }
  }, []);

  if (!authenticated) return null; // No renderiza el mapa hasta verificar autenticación

  return <MapboxMap />;
};

export default Home;
