"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MapboxMap = dynamic(() => import("../components/map/Map"), { ssr: false });

const Home = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [loaded, setLoaded] = useState(false); // 🔹 Nuevo estado para forzar re-render
  const router = useRouter();

  useEffect(() => {
    const password = sessionStorage.getItem("password");
    if (password !== "Xx9$gT!7mP@vQ3zK#f") {
      router.push("/login");
    } else {
      setAuthenticated(true);
      setTimeout(() => setLoaded(true), 100); // 🔹 Pequeño delay para evitar problemas de superposición
    }
  }, []);

  if (!authenticated) return <div className="absolute inset-0 bg-black"></div>;

  return loaded ? <MapboxMap /> : null; // 🔹 Se asegura de que renderice bien
};

export default Home;
