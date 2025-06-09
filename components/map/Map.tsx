"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import mapboxgl from "mapbox-gl";
import DeckGL from "@deck.gl/react";
import { HexagonLayer } from "@deck.gl/aggregation-layers";
import Map, { ViewState } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

const API_URL = "/api/quality_points";

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
  DATE?: string | null;
}

// Determina color según calidad
function getQualityColor(quality: number): string {
  if (quality < 30) return "bg-red-500";
  if (quality < 70) return "bg-yellow-500";
  return "bg-green-500";
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

  // Estados
  const [viewState, setViewState] = useState<ViewState>(initialViewState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
    
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [selectedMeasurements, setSelectedMeasurements] = useState<PointMeasurement[] | null>(null);
  const [clickedPointIds, setClickedPointIds] = useState<number[] | null>(null);

  // Formatea fecha
  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    // Ajuste horario +2
    date.setHours(date.getHours() + 2);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${day}-${month}-${year} -- ${hours}:${minutes}:${seconds}`;
  };

  // Fetch con distinción 404 (punto sin conexiones) vs error
  async function fetchPointMeasurements(pointId: number, pointDate: string | null ): Promise<PointMeasurement[] | null> {
    try {
      const response = await fetch(`${API_URL}/${pointId}`);

      // CASO A: Servidor responde 404 => punto sin mediciones
      if (response.status === 404) {
        const fecha = pointDate ? formatDate(pointDate) : "desconocida";
        setInfoMessage(`El punto ${pointId} tomado en fecha: ${fecha} no estableció conexión con ningún gateway.`);
        setErrorMessage(null);
        setSelectedMeasurements(null);
        return null;
      }

      // CASO B: Otro error HTTP
      if (!response.ok) {
        setErrorMessage("Hubo un error al obtener mediciones");
        setInfoMessage(null);
        setSelectedMeasurements(null);
        return null;
      }

      // CASO C: Respuesta 200 => parseamos
      const data = await response.json();
      // Por si la API devuelve array vacío en lugar de 404:
      if (!data || data.length === 0) {
        const fecha = pointDate ? formatDate(pointDate) : "desconocida";
        setInfoMessage(`El punto ${pointId} tomado en fecha: ${fecha} no estableció conexión con ningún gateway.`);
        setErrorMessage(null);
        setSelectedMeasurements(null);
        return null;
      }

      // CASO D: Hay datos
      setInfoMessage(null);
      setErrorMessage(null);
      return data;
    } catch {
      // Error de conexión, etc.
      setErrorMessage("Hubo un error al cargar las mediciones");
      setInfoMessage(null);
      setSelectedMeasurements(null);
      return null;
    }
  }

  // Definir la capa de hexágonos
  const hexagonLayer = new HexagonLayer<PointData>({
    id: "hexagon-layer",
    data: API_URL,
    getPosition: (d) => d.COORDINATES,
    extruded: true,
    radius: 7,
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
    onClick: (info: any): boolean => {
      if (info && info.object) {
        const cell = info.object;
        const pointIds = cell.points.map((pt: PointData) => pt.ID).filter(Boolean);
        const dates = cell.points.map((pt: PointData) => pt.DATE ?? null);
        if (pointIds.length > 0) {
          fetchPointMeasurements(pointIds[0],dates[0])
            .then((measurements) => {
              if (measurements) {
                setSelectedMeasurements(measurements);
                setClickedPointIds(pointIds);
              } else {
                // Si measurements es null, ya hemos seteado infoMessage o errorMessage
                setClickedPointIds(pointIds);
              }
            })
            .catch(() => {
              setErrorMessage("Hubo un error al obtener mediciones");
              setSelectedMeasurements(null);
              setClickedPointIds(null);
              setInfoMessage(null);
            });
        } else {
          // Sin IDs => punto sin conexiones
          setInfoMessage(`El punto no estableció conexión con ningún gateway.`);
          setErrorMessage(null);
          setSelectedMeasurements(null);
          setClickedPointIds(null);
        }
      }
      return true;
    },
  });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/petherem/cl2hdvc6r003114n2jgmmdr24"
        style={{ width: "100%", height: "100%" }}
      />

      <DeckGL
        viewState={viewState}
        onViewStateChange={(evt) => setViewState(evt.viewState as ViewState)}
        controller={true}
        layers={[hexagonLayer]}
        style={{ position: "absolute", width: "100%", height: "100%" }}
      />

      {/* POPUP para error / info / mediciones */}
      {(errorMessage || infoMessage || selectedMeasurements) && (
        <div
          className="
            absolute
            top-2 right-4
            w-80
            bg-black/70
            text-white
            p-3
            rounded-lg
            shadow-lg
            z-50
            backdrop-blur-sm
          "
        >
          {/* Si es un error real */}
          {errorMessage && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Error</h3>
                <button
                  onClick={() => {
                    setErrorMessage(null);
                    setInfoMessage(null);
                    setSelectedMeasurements(null);
                  }}
                  className="text-lg font-bold hover:text-gray-300"
                >
                  ×
                </button>
              </div>
              <p className="text-sm">{errorMessage}</p>
            </>
          )}

          {/* Si es un mensaje informativo (punto sin conexiones) */}
          {infoMessage && !errorMessage && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Información</h3>
                <button
                  onClick={() => {
                    setInfoMessage(null);
                    setErrorMessage(null);
                    setSelectedMeasurements(null);
                  }}
                  className="text-lg font-bold hover:text-gray-300"
                >
                  ×
                </button>
              </div>
              <p className="text-sm">{infoMessage}</p>
            </>
          )}

          {/* Si hay mediciones */}
          {selectedMeasurements && !errorMessage && !infoMessage && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold leading-tight">
                  Conexiones del punto {clickedPointIds && clickedPointIds[0]}
                </h3>
                <button
                  onClick={() => {
                    setSelectedMeasurements(null);
                    setErrorMessage(null);
                    setInfoMessage(null);
                  }}
                  className="text-lg font-bold hover:text-gray-300"
                >
                  ×
                </button>
              </div>

              <p className="text-xs mb-2">
              <strong>Fecha :</strong>{" "}
  {clickedPointIds && clickedPointIds.length > 0
    ? formatDate(
        (hexagonLayer.props.data as PointData[])
          .find((pt) => pt.ID === clickedPointIds[0])?.DATE || selectedMeasurements[0].created_at
      )
    : formatDate(selectedMeasurements[0].created_at)}

              </p>
              <p className="text-xs font-medium">Gateways:</p>
              <ul className="space-y-2 mt-2">
                {selectedMeasurements.map((m) => {
                  const barColor = getQualityColor(m.quality);
                  return (
                    <li key={m.id} className="border-b border-gray-600 pb-1">
                      <div className="flex justify-between text-xs">
                        <span>Id: {m.gateway_id}</span>
                        <span>Calidad: {m.quality}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded h-2 mt-1 overflow-hidden">
                        <div
                          className={`${barColor} h-2 transition-all duration-300`}
                          style={{ width: `${m.quality}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MapboxMap;
