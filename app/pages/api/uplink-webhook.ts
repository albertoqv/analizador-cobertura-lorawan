import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const uplinkData = req.body; // Recibe el JSON enviado por TTN
    console.log("📡 Uplink recibido:", JSON.stringify(uplinkData, null, 2));

    // Opcional: Procesar datos (ejemplo: extraer payload)
    const deviceId = uplinkData?.end_device_ids?.device_id;
    const payloadRaw = uplinkData?.uplink_message?.frm_payload;
    const decodedPayload = payloadRaw ? Buffer.from(payloadRaw, 'base64').toString('utf-8') : null;

    console.log(`📡 Dispositivo: ${deviceId}, Payload Decodificado: ${decodedPayload}`);

    // Responder con éxito a TTN
    res.status(200).json({ message: 'Webhook procesado correctamente' });

  } catch (error) {
    console.error("❌ Error procesando el webhook:", error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
