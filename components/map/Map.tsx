"use client";

import React, { useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import DeckGL from "@deck.gl/react";
import { HexagonLayer } from "@deck.gl/aggregation-layers";
import Map, { ViewState } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const API_URL = "/api/quality_points";

const MapboxMap = () => {
  const initialViewState = {
    longitude: -4.78,
    latitude: 37.88,
    zoom: 12,
    pitch: 40,
    bearing: 0,
    padding: {},
  };

  const [viewState, setViewState] = useState<ViewState>(initialViewState);

  // ✅ Capa de hexágonos con colores en función de `SCORE`
  const hexagonLayer = new HexagonLayer({
    id: "hexagon-layer",
    data: API_URL, // Mantenemos la URL como en tu código original
    getPosition: (d) => d.COORDINATES,
    extruded: true,
    radius: 15, // Ajustamos el tamaño
    pickable: true,

    // ✅ Usamos `getColorValue` para definir el color según `SCORE`
    getColorValue: (points) => {
      if (points.length === 0) return 0;
      return points[0].SCORE;
    },

    // ✅ Configuración correcta con `quantize`
    colorScaleType: "quantize",
    colorDomain: [0, 100], // Se permite SOLO dos valores (min y max)
    colorRange: [
      [255, 0, 0],    // Rojo para valores más bajos (≤ 25)
      [255, 165, 0],  // Naranja para valores intermedios (25 - 75)
      [0, 255, 0],    // Verde para valores más altos (≥ 75)
    ],

    // ✅ Elevación según `SCORE`
    getElevationValue: (points) => {
      if (points.length === 0) return 0;
      return points[0].SCORE;
    },
    elevationScale: 0,
  });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Mapa de fondo */}
      <Map
        {...viewState}
        initialViewState={initialViewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/petherem/cl2hdvc6r003114n2jgmmdr24"
        style={{ width: "100%", height: "100%", position: "absolute" }}
      />

      {/* Capa de hexágonos sincronizada con Mapbox */}
      <DeckGL
        viewState={viewState}
        onViewStateChange={(evt) => setViewState(evt.viewState as ViewState)}
        controller={true}
        layers={[hexagonLayer]}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />
    </div>
  );
};

export default MapboxMap;
