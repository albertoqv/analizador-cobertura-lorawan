"use client";

import React, { useState, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import DeckGL from "@deck.gl/react";
import { HexagonLayer } from "@deck.gl/aggregation-layers";
import Map, { ViewState } from "react-map-gl/mapbox";

import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
console.log("🔍 MAPBOX TOKEN:", process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

const API_URL = "/api/quality_points";

const MapboxMap = () => {
  // 1. Estado para la vista del mapa
  const [viewState, setViewState] = useState<ViewState>({
    longitude: -4.78,
    latitude: 37.88,
    zoom: 12,
    pitch: 40,
    bearing: 0,
    padding: {},
  });

  // 2. Estado para los datos que vienen de /api/quality_points
  const [pointsData, setPointsData] = useState<any[]>([]);

  // 3. Cargar los datos en un efecto, para poder loguearlos
  useEffect(() => {
    console.log("🔍 Fetching data from", API_URL);
    fetch(API_URL)
      .then((res) => res.json())
      .then((json) => {
        console.log("🔍 Data received from /api/quality_points:", json);
        setPointsData(json);
      })
      .catch((err) => {
        console.error("❌ Error fetching data:", err);
      });
  }, []);

  // 4. Definir la capa de hexágonos usando la data que tenemos en el estado
  const hexagonLayer = new HexagonLayer({
    id: "hexagon-layer",
    data: pointsData, // Ahora pasamos el array, no la URL
    pickable: true,
    extruded: true,
    radius: 15,

    // Esta función se llamará por cada punto, así que generará muchos logs
    getPosition: (d) => {
      console.log("🔍 getPosition -> d:", d);
      return d.COORDINATES;
    },

    // Cálculo del color según el primer punto del cluster
    getColorValue: (points) => {
      if (points.length === 0) return 0;
      return points[0].SCORE;
    },
    colorScaleType: "quantize",
    colorDomain: [0, 100],
    colorRange: [
      [255, 0, 0],
      [255, 165, 0],
      [0, 255, 0],
    ],

    // Cálculo de la altura según el primer punto
    getElevationValue: (points) => {
      if (points.length === 0) return 0;
      return points[0].SCORE;
    },
    elevationScale: 0.5,
  });

  // 5. Renderizar mapa y capa
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/petherem/cl2hdvc6r003114n2jgmmdr24"
        style={{ width: "100%", height: "100%", position: "relative" }}
      />

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
