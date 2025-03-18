"use client";

import React, { useState } from "react";
import mapboxgl from "mapbox-gl";
import DeckGL from "@deck.gl/react";
import { HexagonLayer } from "@deck.gl/aggregation-layers";
import Map, { ViewState } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

// Aseguramos que el token sea un string
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

const API_URL = "/api/quality_points";

// Definimos interfaces para los datos
interface PointMeasurement {
  id: number;
  gateway_id: string;
  quality: number;
  created_at: string;
}

interface PointData {
  ID: number;
  COORDINATES: [number, number];
  SCORE: number;
}

const MapboxMap: React.FC = () => {
  const initialViewState: ViewState = {
    longitude: -4.78,
    latitude: 37.88,
    zoom: 12,
    pitch: 40,
    bearing: 0,
    padding: {},
  };

  const [viewState, setViewState] = useState<ViewState>(initialViewState);
  const [selectedMeasurements, setSelectedMeasurements] = useState<PointMeasurement[] | null>(null);
  const [clickedPointIds, setClickedPointIds] = useState<number[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Función para obtener las mediciones completas de un punto
  async function fetchPointMeasurements(pointId: number): Promise<PointMeasurement[] | null> {
    try {
      const response = await fetch(`${API_URL}/${pointId}`);
      if (!response.ok) {
        setErrorMessage("Hubo un error al obtener mediciones");
        return null;
      }
      const data = await response.json();

      if (data.message) {
        setErrorMessage(data.message);
        return null;
      }

      if (!data || data.length === 0) {
        setErrorMessage("Este punto no recibió conexión de ningún gateway");
        return null;
      }

      setErrorMessage(null);
      return data;
    } catch (_error) {
      setErrorMessage("Hubo un error al cargar las mediciones");
      return null;
    }
  }

  // Función para formatear la fecha y sumar 1 hora
  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    date.setHours(date.getHours() + 1);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} -- ${hours}:${minutes}:${seconds}`;
  };

  interface HexagonInfo {
    object?: {
      points: PointData[];
    };
  }

  const hexagonLayer = new HexagonLayer<PointData>({
    id: "hexagon-layer",
    data: API_URL,
    getPosition: (d) => d.COORDINATES,
    extruded: true,
    radius: 15,
    pickable: true,
    getColorValue: (points) => points[0]?.SCORE || 0,
    colorScaleType: "quantize",
    colorDomain: [0, 100],
    colorRange: [
      [255, 0, 0],
      [255, 165, 0],
      [0, 255, 0],
    ],
    getElevationValue: (points) => points[0]?.SCORE || 0,
    elevationScale: 0.5,
    onClick: (info: any, event: any): boolean => {
      if (info && info.object) {
        const cell = info.object;
        const pointIds = cell.points.map((pt: PointData) => pt.ID).filter(Boolean);
        
        if (pointIds.length > 0)  {
          fetchPointMeasurements(pointIds[0])
            .then((measurements) => {
              if (measurements) {
                setSelectedMeasurements(measurements);
                setClickedPointIds(pointIds);
              } else {
                setErrorMessage("Este punto no recibió conexión de ningún gateway");
                setSelectedMeasurements(null);
                setClickedPointIds(null);
              }
            })
            .catch(() => {
              setErrorMessage("Hubo un error al obtener mediciones");
              setSelectedMeasurements(null);
              setClickedPointIds(null);
            });
        } else {
          setSelectedMeasurements(null);
          setClickedPointIds(null);
          setErrorMessage("Este punto no recibió conexión de ningún gateway");
        }
      }
      return true;
    },
  });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Map
        {...viewState}
        initialViewState={initialViewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/petherem/cl2hdvc6r003114n2jgmmdr24"
        style={{ width: "100%", height: "100%", position: "relative", zIndex: 0 }}
      />

      <DeckGL
        viewState={viewState}
        onViewStateChange={(evt) => setViewState(evt.viewState as ViewState)}
        controller={true}
        layers={[hexagonLayer]}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />

      {/* Mensajes de error o información */}
      {(errorMessage || selectedMeasurements) && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "20px",
            background: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
            zIndex: 9999,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "300px",
          }}
        >
          <button
            onClick={() => {
              setErrorMessage(null);
              setSelectedMeasurements(null);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "white",
              cursor: "pointer",
              fontSize: "22px",
              fontWeight: "bold",
            }}
          >
            ×
          </button>
          {errorMessage && <p style={{ margin: 0, flexGrow: 1 }}>{errorMessage}</p>}
          {selectedMeasurements && !errorMessage && (
            <div>
              <h3>Mediciones del punto {clickedPointIds && clickedPointIds[0]}</h3>
              <strong>Fecha:</strong> {formatDate(selectedMeasurements[0].created_at)} <br />
              <strong>Conexiones:</strong>
              <ul>
                {selectedMeasurements.map((m: PointMeasurement) => (
                  <li
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "5px 0",
                      borderBottom: "1px solid #ccc",
                    }}
                  >
                    <span>→ Gateway ID: {m.gateway_id}</span>
                    <span>Calidad: {m.quality}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapboxMap;